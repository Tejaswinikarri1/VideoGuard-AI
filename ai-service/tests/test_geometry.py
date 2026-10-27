from app.geometry import point_in_polygon, validate_polygon

SQ = [(0.2, 0.2), (0.8, 0.2), (0.8, 0.8), (0.2, 0.8)]


def test_inside_outside():
    assert point_in_polygon((0.5, 0.5), SQ)
    assert not point_in_polygon((0.1, 0.5), SQ)
    assert not point_in_polygon((0.5, 0.9), SQ)


def test_validation():
    assert validate_polygon(SQ) == []
    assert validate_polygon([(0, 0), (1, 1)])
    assert validate_polygon([(0.1, 0.1), (1.5, 0.1), (0.5, 0.5)])          # out of range
    assert validate_polygon([(0.1, 0.1), (0.9, 0.9), (0.1, 0.9), (0.9, 0.1)])  # bow-tie
    assert validate_polygon([(0.1, 0.1), (0.2, 0.2), (0.3, 0.3)])          # collinear
