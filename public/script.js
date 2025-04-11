// Get elements
const canvas = document.getElementById('fireflyCanvas');
const ctx = canvas.getContext('2d');
const messageBox = document.getElementById('messageBox');
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');

// Configuration
const numFireflies = 50;
const fireflyColor = 'rgba(255, 255, 150, ';
const constantAlpha = 0.8;
const maxRadius = 2.5;
const minRadius = 1.0;
const maxSpeed = 0.6;
const minSpeed = 0.1;
const glowIntensityFactor = 10;
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY'; // Replace with your actual key

let fireflies = [];
let currentSequence = null;
let isPlayingSequence = false;


// OpenAI Integration
async function generateLightSequence(query) {
    const messages = [
        { role: "system", content: "Your goal is to translate the user text into a series of instructions for a light sequence.  The light sequence is an expressive response to the users input. An example is as follows: {\"instructions\": [{\"phase\": 1,\"flashes\": 4,\"durationOn\": 300,\"durationOff\": 150,\"lightColour\": \"Green\"},{\"phase\": 2,\"flashes\": 6,\"durationOn\": 300,\"durationOff\": 100,\"lightColour\": \"Pink\"}]}" },
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('OpenAI API Response:', data);
        return data;
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}


// Utility Functions
function resizeCanvas() {
    const inputContainer = document.querySelector('.input-container');
    const inputContainerHeight = inputContainer ? inputContainer.offsetHeight : 100;
    const availableHeight = window.innerHeight - inputContainerHeight - (window.innerHeight * 0.04);
    const availableWidth = window.innerWidth * 0.9;

    canvas.width = availableWidth;
    canvas.height = Math.min(window.innerHeight * 0.8, availableHeight);

    canvas.width = Math.max(100, canvas.width); // Ensure minimum width
    canvas.height = Math.max(100, canvas.height); // Ensure minimum height


    if (fireflies.length > 0) {
        fireflies.forEach(f => {
            f.x = Math.min(Math.max(0, f.x), canvas.width);
            f.y = Math.min(Math.max(0, f.y), canvas.height);
        });
    } else {
        initializeFireflies();
    }
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function showMessage(message, duration = 3000) {
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    messageBox.style.opacity = 1;  // Ensure opacity is set for showing

    if (duration > 0) {
        setTimeout(() => {
            messageBox.style.opacity = 0; // Fade out
            setTimeout(() => messageBox.style.display = 'none', 300); // Hide after fade out
        }, duration);
    }
}


function hideMessage() {
    messageBox.style.opacity = 0;
    setTimeout(() => messageBox.style.display = 'none', 300);
}



// Firefly Class
class Firefly {
    constructor() {
        this.x = random(0, canvas.width);
        this.y = random(0, canvas.height);
        const angle = random(0, Math.PI * 2);
        const speed = random(minSpeed, maxSpeed);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = random(minRadius, maxRadius);
        this.alpha = constantAlpha;
        this.color = fireflyColor;
    }


    update(deltaTime) {
        this.vx += random(-0.05, 0.05);
        this.vy += random(-0.05, 0.05);

        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > maxSpeed) {
            this.vx = (this.vx / currentSpeed) * maxSpeed;
            this.vy = (this.vy / currentSpeed) * maxSpeed;
        } else if (currentSpeed < minSpeed && currentSpeed > 0) {
            this.vx = (this.vx / currentSpeed) * minSpeed;
            this.vy = (this.vy / currentSpeed) * minSpeed;
        } else if (currentSpeed === 0) { // Handle zero speed
            const angle = random(0, Math.PI * 2);
            this.vx = Math.cos(angle) * minSpeed;
            this.vy = Math.sin(angle) * minSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        const boundaryOffset = this.radius * glowIntensityFactor;
        if (this.x < -boundaryOffset) this.x = canvas.width + boundaryOffset;
        if (this.x > canvas.width + boundaryOffset) this.x = -boundaryOffset;
        if (this.y < -boundaryOffset) this.y = canvas.height + boundaryOffset;
        if (this.y > canvas.height + boundaryOffset) this.y = -boundaryOffset;
    }


    draw() {
        const gradient = ctx.createRadialGradient(
            this.x, this.y, this.radius * 0.5,
            this.x, this.y, this.radius * glowIntensityFactor
        );

        gradient.addColorStop(0, this.color + this.alpha + ')');
        gradient.addColorStop(0.3, this.color + (this.alpha * 0.5) + ')');
        gradient.addColorStop(1, this.color + '0)');

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * glowIntensityFactor, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    setColor(color) {
        this.color = color;
    }
}



// Initialization
function initializeFireflies() {
    fireflies = [];
    for (let i = 0; i < numFireflies; i++) {
        fireflies.push(new Firefly());
    }
}



// Animation Loop
let lastTime = 0;
function animate(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    fireflies.forEach(firefly => {
        firefly.update(deltaTime);
        firefly.draw();
    });

    requestAnimationFrame(animate);
}




// Sequence Playing
async function playSequence(sequence) {
    if (isPlayingSequence) return; // Prevent overlapping sequences
    isPlayingSequence = true;

    for (const phase of sequence.instructions) {
        const color = phase.lightColour.toLowerCase();  // Ensure lowercase for color matching
        const rgbaColor = `rgba(${getColorRGB(color)}, `;

        fireflies.forEach(firefly => firefly.setColor(rgbaColor));

        for (let i = 0; i < phase.flashes; i++) {
            fireflies.forEach(firefly => firefly.alpha = 1);
            await new Promise(resolve => setTimeout(resolve, phase.durationOn));
            fireflies.forEach(firefly => firefly.alpha = 0.2); // Dimmed off-state
            await new Promise(resolve => setTimeout(resolve, phase.durationOff));
        }
    }

    // Reset fireflies after sequence
    fireflies.forEach(firefly => {
        firefly.setColor(fireflyColor);
        firefly.alpha = constantAlpha;
    });


    isPlayingSequence = false;
}



function getColorRGB(color) {
    const colors = {
        'red': '255, 0, 0',
        'green': '0, 255, 0',
        'blue': '0, 0, 255',
        'yellow': '255, 255, 0',
        'pink': '255, 192, 203',
        'purple': '128, 0, 128',
        'orange': '255, 165, 0',
        'white': '255, 255, 255'
        // Add more colors as needed
    };
    return colors[color] || '255, 255, 150'; // Default yellowish
}




// Event Listeners
window.addEventListener('resize', resizeCanvas);

sendButton.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (text) {
        try {
            showMessage('Generating sequence...', 0); // Show message indefinitely
            sendButton.disabled = true;  // Disable button during API call

            const response = await generateLightSequence(text);
            if (response.choices && response.choices[0] && response.choices[0].message) {
                const lightSequence = JSON.parse(response.choices[0].message.content);
                console.log('Parsed Light Sequence:', lightSequence);
                await playSequence(lightSequence);
                hideMessage();
                showMessage('Sequence completed!');
            } else {
                throw new Error('Invalid response format from OpenAI');
            }

        } catch (error) {
            console.error('Error:', error);
            hideMessage(); // Hide "Generating..." message in case of error
            showMessage('Error generating sequence. Please try again.');
        } finally {
            sendButton.disabled = false;
            textInput.value = ''; // Clear input field
        }

    } else {
        showMessage('Please enter some text.');
    }
});




// Start
resizeCanvas();
requestAnimationFrame(animate);