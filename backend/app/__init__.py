from flask import Flask, jsonify, request
from .config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS

# 1. Create Extension instances
db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()
login_manager = LoginManager()
cors = CORS()

def create_app(config_class=Config):
    """Construct the core application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # --- THIS IS THE FINAL FIX ---
    # Tell Flask to set the session cookie with SameSite=None
    # This is required for cross-origin requests with credentials.
    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    app.config["SESSION_COOKIE_SECURE"] = True # 'None' also requires the 'Secure' flag
    # --- END OF FIX ---

    # 2. Initialize Plugins
    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    cors.init_app(app,
                  origins=["http://localhost:3000"],
                  methods=["GET", "POST", "PUT", "OPTIONS"],
                  allow_headers=["Content-Type"],
                  supports_credentials=True)

    # 3. Configure Flask-Login
    login_manager.login_view = None

    @login_manager.user_loader
    def load_user(user_id):
        from .models import User
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify(error="Login required"), 401

    # 4. Register Blueprints
    with app.app_context():
        from . import routes
        app.register_blueprint(routes.api, url_prefix='/api')

    return app

