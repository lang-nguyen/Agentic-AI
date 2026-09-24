# Domain: Retail & E-commerce System (Company: NovaMart)

NovaMart is a retail and e-commerce company that sells consumer products such as clothing, electronics, and accessories.

The system manages users, products, and orders.

### Time System
- All timestamps are stored in EST (Eastern Standard Time)
- Format: 24-hour time (e.g. 02:30:00 = 2:30 AM EST)

### Users
Each user has:
- user_id
- email
- default shipping address
- multiple payment methods (credit card, PayPal, gift card)

### Products
- The catalog contains multiple product types (e.g., T-shirt, Shoes)
- Each product type has multiple variants (items)
- Each product has a unique product_id
- Each variant/item has a unique item_id
- product_id and item_id are independent identifiers

### Orders
- Orders belong to a single user
- Orders contain one or more items
- Order statuses:
  - pending
  - processed
  - delivered
  - cancelled
