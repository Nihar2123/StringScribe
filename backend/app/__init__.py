from flask import Flask, jsonify, request
from .config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS

# 1. Create Extension instances at the top level
# These will be initialized with the app inside the factory function.
db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()
login_manager = LoginManager()
cors = CORS()

def create_app(config_class=Config):
    """Constructs the core application and its components."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Security setting for session cookies to work across different ports (e.g., 3000 -> 5001)
    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    app.config["SESSION_COOKIE_SECURE"] = True

    # 2. Initialize all plugins with the app instance
    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    # Configure CORS to allow all necessary methods, including DELETE
    cors.init_app(app,
                  origins=["http://localhost:3000"],
                  methods=["GET", "POST", "PUT", "OPTIONS", "DELETE"], # <-- DELETE is included
                  allow_headers=["Content-Type"],
                  supports_credentials=True)

    # 3. Configure Flask-Login
    # Disables the default "redirect to login page" behavior, which is not needed for an API
    login_manager.login_view = None

    @login_manager.user_loader
    def load_user(user_id):
        """Tells Flask-Login how to find a user from the ID stored in the session."""
        from .models import User # Import here to avoid circular dependencies
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        """Returns a JSON error when a user tries to access a protected route without being logged in."""
        return jsonify(error="Login required"), 401

    # 4. Register the API routes (Blueprint) with the app
    with app.app_context():
        from . import routes
        app.register_blueprint(routes.api, url_prefix='/api')

    return app

