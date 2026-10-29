import os

from backend.app import create_app

app = create_app()


if __name__ == "__main__":
    print("Server admin is running on http://127.0.0.1:5000/update-products.html"),
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
    )
