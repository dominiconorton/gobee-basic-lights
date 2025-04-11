const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fetch = require('node-fetch');  // Import node-fetch
const port = process.env.PORT || 3000;


// API key - BEST PRACTICE: Use environment variables for sensitive data
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY'; // Replace or set environment variable


app.use(express.static(__dirname + '/public'));


io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('generateSequence', async (text) => {
        try {
            const sequence = await generateLightSequence(text);
            socket.emit('sequenceGenerated', sequence);
        } catch (error) {
            console.error("OpenAI Error:", error);
            socket.emit('sequenceError', error.message);
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
            content: "Your goal is to translate the user text into a series of instructions for a light sequence. The light sequence is an expressive response to the users input. An example is as follows: {\"instructions\": [{\"phase\": 1,\"flashes\": 4,\"durationOn\": 300,\"durationOff\": 150,\"lightColour\": \"Green\"},{\"phase\": 2,\"flashes\": 6,\"durationOn\": 300,\"durationOff\": 100,\"lightColour\": \"Pink\"}]}"
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
            const errorData = await response.json(); // Get error details from OpenAI
            const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : `HTTP error ${response.status}`;
            throw new Error(errorMessage); // Throw a more descriptive error
        }


        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
             throw new Error("Invalid response format from OpenAI API");
        }

        try {
             const sequence = JSON.parse(data.choices[0].message.content);
             return sequence;
        } catch (parseError) {
            console.error("Error parsing JSON:", parseError, data.choices[0].message.content); // Log the unparsable content
            throw new Error("Error parsing light sequence from OpenAI response. The response might not be in the correct format.");
        }

    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw error;  // Re-throw the error to be handled by the Socket.IO error handler
    }
}





server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});