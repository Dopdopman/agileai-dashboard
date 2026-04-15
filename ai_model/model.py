import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error
import joblib

class AgileAIModel:
    def __init__(self):
        # Classification model for Risk Detection
        self.risk_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        # Regression model for Delay Prediction
        self.delay_regressor = GradientBoostingRegressor(n_estimators=100, random_state=42)
        
    def prepare_data(self, data):
        """
        Prepares data for training.
        Input features:
        - velocity_trend: Change in velocity over last 3 sprints
        - backlog_size: Total points in backlog
        - issue_aging: Average age of open issues (days)
        - cycle_time_avg: Average cycle time (days)
        - team_capacity: Available team hours
        """
        df = pd.DataFrame(data)
        
        X = df[['velocity_trend', 'backlog_size', 'issue_aging', 'cycle_time_avg', 'team_capacity']]
        
        # Target for classification: 1 if sprint failed/at risk, 0 if healthy
        y_risk = df['is_at_risk']
        
        # Target for regression: Days of delay
        y_delay = df['delay_days']
        
        return X, y_risk, y_delay
        
    def train(self, data):
        print("Training AI Models...")
        X, y_risk, y_delay = self.prepare_data(data)
        
        # Split data
        X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X, y_risk, test_size=0.2, random_state=42)
        X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(X, y_delay, test_size=0.2, random_state=42)
        
        # Train Risk Classifier
        self.risk_classifier.fit(X_train_c, y_train_c)
        risk_preds = self.risk_classifier.predict(X_test_c)
        print(f"Risk Classifier - Accuracy: {accuracy_score(y_test_c, risk_preds):.2f}, F1: {f1_score(y_test_c, risk_preds):.2f}")
        
        # Train Delay Regressor
        self.delay_regressor.fit(X_train_r, y_train_r)
        delay_preds = self.delay_regressor.predict(X_test_r)
        print(f"Delay Regressor - MAE: {mean_absolute_error(y_test_r, delay_preds):.2f} days")
        
        # Save models
        joblib.dump(self.risk_classifier, 'risk_model.pkl')
        joblib.dump(self.delay_regressor, 'delay_model.pkl')
        print("Models saved successfully.")
        
    def predict(self, current_sprint_data):
        """
        Predicts risk and delay for the current sprint.
        """
        df = pd.DataFrame([current_sprint_data])
        features = df[['velocity_trend', 'backlog_size', 'issue_aging', 'cycle_time_avg', 'team_capacity']]
        
        risk_prob = self.risk_classifier.predict_proba(features)[0][1]
        is_at_risk = self.risk_classifier.predict(features)[0]
        predicted_delay = self.delay_regressor.predict(features)[0]
        
        return {
            "risk_probability": float(risk_prob),
            "is_at_risk": bool(is_at_risk),
            "predicted_delay_days": float(predicted_delay)
        }

# Example Usage
if __name__ == "__main__":
    # Mock training data
    mock_data = [
        {"velocity_trend": -5, "backlog_size": 150, "issue_aging": 12, "cycle_time_avg": 8, "team_capacity": 400, "is_at_risk": 1, "delay_days": 4},
        {"velocity_trend": 2, "backlog_size": 80, "issue_aging": 3, "cycle_time_avg": 4, "team_capacity": 400, "is_at_risk": 0, "delay_days": 0},
        {"velocity_trend": -10, "backlog_size": 200, "issue_aging": 20, "cycle_time_avg": 12, "team_capacity": 350, "is_at_risk": 1, "delay_days": 7},
        {"velocity_trend": 5, "backlog_size": 100, "issue_aging": 5, "cycle_time_avg": 5, "team_capacity": 420, "is_at_risk": 0, "delay_days": 0},
        {"velocity_trend": -2, "backlog_size": 120, "issue_aging": 8, "cycle_time_avg": 6, "team_capacity": 380, "is_at_risk": 0, "delay_days": 1},
    ] * 20 # Duplicate to have enough samples for train_test_split
    
    model = AgileAIModel()
    model.train(mock_data)
    
    current_sprint = {"velocity_trend": -4, "backlog_size": 140, "issue_aging": 10, "cycle_time_avg": 7.5, "team_capacity": 390}
    predictions = model.predict(current_sprint)
    print("Predictions for current sprint:", predictions)
