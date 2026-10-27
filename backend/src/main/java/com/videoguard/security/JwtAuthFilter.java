package com.videoguard.security;

import com.videoguard.users.User;
import com.videoguard.users.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashSet;

/** Not a Spring bean on purpose: it is constructed in SecurityConfig so it only runs inside the security filter chain. */
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserRepository users;

    public JwtAuthFilter(JwtService jwt, UserRepository users) { this.jwt = jwt; this.users = users; }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) {
            try {
                Claims c = jwt.parse(h.substring(7));
                if ("access".equals(c.get("scope"))) {
                    User u = users.findById(c.getSubject()).orElse(null);
                    // Roles and active flag always come from the database, never from the token alone.
                    if (u != null && u.active) {
                        AuthUser p = new AuthUser(u.id, u.email, u.displayName, new HashSet<>(u.roles));
                        var auth = new UsernamePasswordAuthenticationToken(p, null,
                                u.roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList());
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                }
            } catch (JwtService.TokenExpired e) {
                req.setAttribute("tokenExpired", true);
            } catch (Exception ignored) {
                // invalid token -> unauthenticated
            }
        }
        chain.doFilter(req, res);
    }
}
