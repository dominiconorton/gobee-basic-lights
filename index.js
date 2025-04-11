require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fetch = require('node-fetch');
const port = process.env.PORT || 3000;

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is not set');
    process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(express.static(__dirname + '/public'));
app.use(express.json());

// API endpoint for generating sequences
app.post('/generateSequence', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const sequence = await generateLightSequence(text);
        res.json(sequence);
    } catch (error) {
        console.error('Error generating sequence:', error);
        res.status(500).json({ error: 'Failed to generate sequence' });
    }
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('generateSequence', async (text) => {
        try {
            const sequence = await generateLightSequence(text);
            socket.emit('sequenceGenerated', sequence);
        } catch (error) {
            console.error("OpenAI Error:", error);
            socket.emit('sequenceError', error.message); // Emit the error message to the client
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

async function generateLightSequence(query) {
    const messages = [
        {
            role: "system",
            content: "Your goal is to translate the user text into a series of instructions for a light sequence.  The light sequence is an expressive response to the users input. Provide the JSON response directly, without any additional text or explanations. An example is as follows: {\"instructions\": [{\"phase\": 1,\"flashes\": 4,\"durationOn\": 300,\"durationOff\": 150,\"lightColour\": \"Green\"},{\"phase\": 2,\"flashes\": 6,\"durationOn\": 300,\"durationOff\": 100,\"lightColour\": \"Pink\"}]}" // Updated prompt
        },
        { role: "user", content: query }
    ];

    const requestBody = {
        model: "gpt-4",
        messages: messages,
        temperature: 1,
        max_tokens: 2048,
        top_p: 1
    };

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
            throw new Error("Invalid response format from OpenAI API");
        }

        try {
            return JSON.parse(data.choices[0].message.content);
        } catch (parseError) {
            console.error("JSON parsing error:", parseError);
            throw new Error("Invalid JSON response from OpenAI");
        }
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw error;
    }
}

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});