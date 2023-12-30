const port = process.env.PORT || 8081;
const express = require("express");
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require("firebase-admin");
const { hash, compare } = require('bcrypt')
const { getDatabase, ref, push, set, query, orderByChild, equalTo, onValue, get, child } = require('firebase/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto')

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

//Firebase Server Auth
var serviceAccount = require("./FirebaseServiceAccountKey/bus-teknologi-a772c-firebase-adminsdk-izo09-9f83bf60f8.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://bus-teknologi-a772c-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();
const adminRef = db.ref('Admin');

const secretKey = crypto.randomBytes(32).toString('hex');

app.get('/', (req, res) => {
    res.send('Hello World')
})

// Login Backend
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const adminQuery = await adminRef.orderByChild('username').equalTo(username).once('value');

        if (adminQuery.exists()) {
            const adminData = adminQuery.val();

            let passwordMatched = false;

            for (const adminKey in adminData) {
                const adminEntry = adminData[adminKey];

                if (adminEntry.username === username && await compare(password, adminEntry.password)) {
                    const token = jwt.sign({ username: username, key: adminKey }, secretKey);
                    console.log(token);
                    passwordMatched = true;
                    res.json({ success: true, token: token, isRootAdmin: adminEntry.isRootAdmin, role: adminEntry.role });
                    console.log(adminEntry.isRootAdmin)
                    break; // exit the loop if a match is found
                }
            }

            if (!passwordMatched) {
                res.status(401).json({ error: 'Incorrect password' });
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Firebase Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

app.post('/submit-feedback', async (req, res) => {
    try {
        const formData = req.body;

        const { name, email, category, message, rating } = formData;

        const feedbackRef = db.ref('feedback');
        const newFeedbackRef = push(feedbackRef);

        await set(newFeedbackRef, {
            name: name,
            email: email,
            category: category,
            message: message,
            rating: rating,
            timestamp: admin.database.ServerValue.TIMESTAMP, // Optional: Store timestamp
        });

        console.log('Received feedback:', formData);

        // Send a response to the client
        res.status(200).json({ success: true, message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Error handling feedback:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

let driverLocation = null;
let locationTimeout = null;
const locationTimeoutDuration = 5000;

const updateDriverLocation = (location) => {
    driverLocation = location;

    // Reset the timeout
    clearTimeout(locationTimeout);
    locationTimeout = setTimeout(() => {
        // Handle the case when the timeout expires (driver location not updated)
        console.log('Driver location timeout: No location updates received.');
        driverLocation = null; // Set driverLocation to null or handle as needed
    }, locationTimeoutDuration);
};

app.post('/location', async (req, res) => {
    try {
        const { lat, lng } = req.body;

        updateDriverLocation({ lat, lng });

        // Send a response to the client
        res.status(200).json({ success: true, message: 'User location handled successfully on the server' });
    } catch (error) {
        console.error('Error handling user location:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/driver-location', async (req, res) => {
    try {
        // Send the current driver's location to the client
        res.status(200).json({ success: true, location: driverLocation });
    } catch (error) {
        console.error('Error fetching driver location:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/location/select-bus', (req, res) => {
    const { bus } = req.body;

    // Check if the bus is already selected
    if (selectedBuses[bus]) {
        return res.status(400).json({ error: 'Bus already selected by another driver' });
    }

    // Mark the bus as selected
    selectedBuses[bus] = true;

    // You may want to store the bus selection along with the driver ID for a more robust solution

    res.json({ message: 'Bus selected successfully' });
});

app.post('/location/deselect-bus', (req, res) => {
    const { bus } = req.body;

    // Deselect the bus
    delete selectedBuses[bus];

    res.json({ message: 'Bus deselected successfully' });
});

app.post('/location/check-bus', (req, res) => {
    const { bus } = req.body;

    // Check if the bus is already selected
    if (selectedBuses[bus]) {
        return res.status(400).json({ error: 'Bus already selected by another driver' });
    }

    res.json({ message: 'Bus is available' });
});

app.listen(port, () => {
    console.log('Server is running on port ' + port);
})