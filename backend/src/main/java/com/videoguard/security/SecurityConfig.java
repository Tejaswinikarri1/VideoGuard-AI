package com.videoguard.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videoguard.common.ApiResponse;
import com.videoguard.config.AppProperties;
import com.videoguard.users.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    private final ObjectMapper mapper = new ObjectMapper();

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean
    SecurityFilterChain chain(HttpSecurity http, JwtService jwtService, UserRepository users) throws Exception {
        JwtAuthFilter jwt = new JwtAuthFilter(jwtService, users);
        RateLimitFilter rate = new RateLimitFilter();
        http.csrf(AbstractHttpConfigurer::disable)
            .cors(c -> {})
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/actuator/health").permitAll()
                .requestMatchers("/api/v1/media/**").permitAll() // verified by short-lived signed token in MediaController
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .anyRequest().authenticated())
            .exceptionHandling(e -> e.authenticationEntryPoint((req, res, ex) -> {
                boolean expired = Boolean.TRUE.equals(req.getAttribute("tokenExpired"));
                res.setStatus(401);
                res.setContentType("application/json");
                mapper.writeValue(res.getOutputStream(), expired
                        ? ApiResponse.fail("AUTH_TOKEN_EXPIRED", "Your session has expired. Please sign in again.")
                        : ApiResponse.fail("AUTH_REQUIRED", "Authentication is required."));
            }).accessDeniedHandler((req, res, ex) -> {
                res.setStatus(403);
                res.setContentType("application/json");
                mapper.writeValue(res.getOutputStream(), ApiResponse.fail("FORBIDDEN", "You do not have permission to perform this action."));
            }))
            .addFilterBefore(rate, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    CorsConfigurationSource cors(AppProperties p) {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(List.of(p.frontendOrigin()));
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
        c.setExposedHeaders(List.of("X-Request-Id"));
        UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
        s.registerCorsConfiguration("/**", c);
        return s;
    }
}
