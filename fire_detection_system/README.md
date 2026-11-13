# AI/ML-Based Smart Fire and Smoke Detection System (Python / Flask Version)

## Setup Instructions in VS Code
1. Open the `fire_detection_system` folder in VS Code.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Initialize the SQLite database:
   ```bash
   python database/init_db.py
   ```
5. (Optional) Place your trained YOLOv8 weights at:
   `models/fire_detection_model/best.pt`
6. Start the Flask server:
   ```bash
   python app.py
   ```
7. Open `http://127.0.0.1:5000` in your browser.
