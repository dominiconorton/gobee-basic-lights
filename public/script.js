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

let fireflies = [];
let currentSequence = null;
let isPlayingSequence = false;


// OpenAI Integration
async function generateLightSequence(query) {
    try {
        const response = await fetch('/generateSequence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: query })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error calling API:', error);
        throw error;
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
    messageBox.style.opacity = '1';

    if (duration > 0) {
        setTimeout(() => {
            messageBox.style.opacity = '0';
            setTimeout(() => messageBox.style.display = 'none', 300);
        }, duration);
    }
}

function hideMessage() {
    messageBox.style.opacity = '0';
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
            showMessage('Generating sequence...', 0);
            sendButton.disabled = true;

            const response = await generateLightSequence(text);
            console.log('\n=== Full API Response ===');
            console.log('Response type:', typeof response);
            console.log('Response keys:', Object.keys(response));
            console.log('Response value:', JSON.stringify(response, null, 2));
            console.log('=== End Response ===\n');

            // The response should now be the sequence directly
            if (!response || typeof response !== 'object') {
                console.error('\n=== Invalid Response Type ===');
                console.error('Expected object, got:', typeof response);
                console.error('=== End Error ===\n');
                throw new Error('Invalid response type from API');
            }

            if (!response.instructions || !Array.isArray(response.instructions)) {
                console.error('\n=== Invalid Response Structure ===');
                console.error('Response:', JSON.stringify(response, null, 2));
                console.error('Has instructions:', !!response.instructions);
                console.error('Instructions is array:', Array.isArray(response.instructions));
                console.error('=== End Invalid Structure ===\n');
                throw new Error('Invalid response from API');
            }

            // Validate each instruction
            for (const instruction of response.instructions) {
                if (!instruction.phase || !instruction.flashes || 
                    !instruction.durationOn || !instruction.durationOff || 
                    !instruction.lightColour) {
                    console.error('\n=== Invalid Instruction ===');
                    console.error(JSON.stringify(instruction, null, 2));
                    console.error('=== End Invalid Instruction ===\n');
                    throw new Error('Invalid instruction format');
                }
            }

            await playSequence(response);
            hideMessage();
            showMessage('Sequence completed!');

        } catch (error) {
            console.error('\n=== Error ===');
            console.error(error);
            console.error('=== End Error ===\n');
            hideMessage();
            showMessage(`Error: ${error.message}`);
        } finally {
            sendButton.disabled = false;
            textInput.value = '';
        }
    } else {
        showMessage('Please enter some text.');
    }
});




// Start
resizeCanvas();
requestAnimationFrame(animate);