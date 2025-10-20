from app import create_app

# The create_app function (our "factory") builds our Flask app
app = create_app()

if __name__ == "__main__":
    # We run on port 5001 to match your original setup
    app.run(port=5001)
