from agentic_ai.data import load_data_from_session


def test_load_data():
    data = load_data_from_session()
    orders = data.get("orders")
    products = data.get("products")
    users = data.get("users")

    assert len(orders) == 1000
    assert len(products) == 50
    assert len(users) == 500
