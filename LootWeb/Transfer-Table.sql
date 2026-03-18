CREATE TABLE scheduled_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    from_account VARCHAR(50) NOT NULL,
    to_account VARCHAR(50) NOT NULL,
    to_subscriber VARCHAR(50) NOT NULL,
    schedule_type ENUM('now', 'later', 'recurring') NOT NULL,
    transfer_date DATE NULL,
    transfer_time TIME NULL,
    status ENUM('pending', 'active', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);