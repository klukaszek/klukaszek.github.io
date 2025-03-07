class ParticleSystem {
    isIOS() {
        return navigator.userAgent.match(/(iPad|iPhone|iPod)/g);
    }

    constructor() {
        // Constants
        this.WORKGROUP_SIZE = window.mobileCheck() ? 128 : 256;
        this.PARTICLE_COUNT = window.mobileCheck() ? 1000000 : 4000000;

        // State
        this.isRunning = false;
        this.animationFrameId = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastTime = 0;

        // WebGPU objects
        this.device = null;
        this.context = null;
        this.particleBuffer = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.computePipeline = null;
        this.renderPipeline = null;

        // Create and setup canvas
        this.canvas = document.createElement('canvas');
        this.setupCanvas();

        // Bind methods
        this.render = this.render.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
    }

    setupCanvas() {
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1';

        // Insert canvas into DOM immediately to get valid dimensions
        document.body.insertBefore(this.canvas, document.body.firstChild);

        // Set initial canvas size
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * devicePixelRatio;
        this.canvas.height = window.innerHeight * devicePixelRatio;
    }

    async initialize() {
        if (!navigator.gpu) {
            document.getElementById('main-header').getElementsByTagName('a')[0].textContent = 'WebGPU not supported! Visitors should enable WebGPU.';
            throw new Error('WebGPU not supported');
        }

        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance',
            forceFallbackAdapter: false,
        });
        if (!adapter) {
            document.getElementById('main-header').getElementsByTagName('a')[0].textContent = 'WebGPU not supported! Visitors should enable WebGPU.';
            throw new Error('No adapter found');
        }

        this.device = await adapter.requestDevice();

        if (this.isIOS()) {
            document.documentElement.style.webkitTouchCallout = 'none';
            this.canvas.style.transform = 'translateZ(0)';
        }

        this.context = this.canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();

        this.updateCanvasSize();
        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'premultiplied',
        });

        await this.initializeBuffers();
        await this.createPipelines(format);
        this.setupEventListeners();
        this.isRunning = true;
        this.lastTime = performance.now();
        this.addButton();
        this.render();
    }

    async initializeBuffers() {
        this.particleBuffer = this.device.createBuffer({
            size: this.PARTICLE_COUNT * 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
        });

        this.uniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const initShaderModule = this.device.createShaderModule({
            code: `
        struct Particle {
            pos: vec2f,
            vel: vec2f,
        }

        @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

        // Improved hash function for better randomness
        fn hash(p: vec2f) -> f32 {
            var p3 = fract(vec2f(p.x, p.y) * vec2f(.1031, .1030));
            p3 += dot(p3, p3.yx + 33.33);
            return fract((p3.x + p3.y) * p3.x);
        }

        // 2D value noise
        fn noise(p: vec2f) -> f32 {
            let i = floor(p);
            let f = fract(p);
            
            let a = hash(i);
            let b = hash(i + vec2f(1.0, 0.0));
            let c = hash(i + vec2f(0.0, 1.0));
            let d = hash(i + vec2f(1.0, 1.0));
            
            let u = f * f * (3.0 - 2.0 * f);
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        // Fractal Brownian Motion for more natural noise
        fn fbm(p: vec2f) -> f32 {
            let NUM_OCTAVES = 4;
            var value = 0.0;
            var amplitude = 0.5;
            var frequency = 1.0;
            
            for(var i = 0; i < NUM_OCTAVES; i++) {
                value += amplitude * noise(p * frequency);
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        @compute @workgroup_size(${this.WORKGROUP_SIZE})
        fn main(@builtin(global_invocation_id) id: vec3u) {
            if (id.x >= ${this.PARTICLE_COUNT}u) { return; }
            
            let idx = f32(id.x);
            let total = f32(${this.PARTICLE_COUNT});
            
            // Create multiple spiral arms
            let arms = 5.0;
            let particlesPerArm = total / arms;
            let armIndex = floor(idx / particlesPerArm);
            let posInArm = (idx % particlesPerArm) / particlesPerArm;
            
            // Spiral parameters
            let angle = posInArm * 15.0 + (2.0 * 3.14159 * armIndex / arms);
            let radius = pow(posInArm, 0.5) * 0.8;
            
            // Base position on spiral
            var pos = vec2f(
                cos(angle) * radius,
                sin(angle) * radius
            );
            
            // Add multiple layers of noise
            let noiseTime = idx * 0.5;  // Vary noise per particle
            let noisePos = pos;     // Scale noise frequency

            // Replace the parameters with more descriptive names:
            const positionNoiseScale = 0.1;      // Controls main position displacement
            const spiralDistortion = 0.1;        // Controls spiral arm waviness
            const microDetailIntensity = 0.1;    // Controls fine grain noise detail
            const velocityTurbulence = 0.01;     // Controls velocity variation

            // To reduce banding, add more randomization to the velocity and position:
            let noise1 = fbm(noisePos + vec2f(noiseTime, 0.0)) * positionNoiseScale;
            let noise2 = fbm(noisePos * 2.0 + vec2f(0.0, noiseTime)) * spiralDistortion;

            // Add extra noise layers at different frequencies
            let noise3 = fbm(noisePos * 4.0 + vec2f(noiseTime * 0.7, noiseTime * 0.3)) * 0.05;
            let noise4 = fbm(noisePos * 0.5 + vec2f(-noiseTime * 0.2, noiseTime * 0.8)) * 0.15;

            // Combine noise for position
            pos += vec2f(
                noise1 + noise2 * cos(angle) + noise3 + noise4,
                noise1 + noise2 * sin(angle) + noise3 - noise4
            );
            
            // Add micro-detail with varying frequency
            let microNoise = (
                fbm(noisePos * 8.0) * 0.7 + 
                fbm(noisePos * 16.0) * 0.3
            ) * microDetailIntensity;
            pos += vec2f(microNoise);
            
            // Calculate velocity with noise-based variation
            let tangent = vec2f(
                -sin(angle),
                cos(angle)
            );
            
            // More varied velocity calculation
            let speed = mix(0.02, 1.5, posInArm + noise1 + noise3);
            var vel = tangent * speed;

            // Add more complex velocity turbulence
            let velNoise = (
                fbm(noisePos * 3.0 + vec2f(noiseTime * 2.0)) + 
                fbm(noisePos * 6.0 - vec2f(noiseTime)) * 0.5
            ) * velocityTurbulence;
            vel += vec2f(velNoise) - 0.015;

            // Add varying radial component
            let radialStrength = noise1 - 0.5 + noise3 * 0.3;
            let radial = normalize(pos) * speed * (0.2 + noise2 + abs(noise4));
            vel += radial * radialStrength;

            // Add rotation variation to break up straight paths
            let rotationNoise = fbm(noisePos * 2.0 - vec2f(noiseTime * 0.5)) * 0.1;
            let rotationMatrix = mat2x2f(
                cos(rotationNoise), -sin(rotationNoise),
                sin(rotationNoise), cos(rotationNoise)
            );
            vel = rotationMatrix * vel;

            particles[id.x] = Particle(pos, vel);
        }
    `
        });

        const initPipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.device.createBindGroupLayout({
                        entries: [
                            {
                                binding: 0,
                                visibility: GPUShaderStage.COMPUTE,
                                buffer: { type: 'storage' }
                            }
                        ]
                    })
                ]
            }),
            compute: {
                module: initShaderModule,
                entryPoint: 'main'
            }
        });

        const initBindGroup = this.device.createBindGroup({
            layout: initPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.particleBuffer }
                }
            ]
        });

        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(initPipeline);
        computePass.setBindGroup(0, initBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.PARTICLE_COUNT / this.WORKGROUP_SIZE));
        computePass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    async createPipelines(format) {
        // Create shader modules
        const computeShaderModule = this.device.createShaderModule({
            code: `
                struct Particle {
                    pos: vec2f,
                    vel: vec2f,
                }

                struct Uniforms {
                    mouse: vec2f,
                    deltaTime: f32,
                    _pad: f32,
                }

                @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
                @group(0) @binding(1) var<uniform> uniforms: Uniforms;

                @compute @workgroup_size(${this.WORKGROUP_SIZE})
                fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                    if (id.x >= ${this.PARTICLE_COUNT}u) { return; }

                    let attraction = 0.3;
                    let maxSpeed = 0.5;
                    let dt = uniforms.deltaTime;

                    var particle = particles[id.x];

                    let toMouse = (uniforms.mouse * 0.2) - particle.pos;
                    let dist = length(toMouse);
                    
                    if (dist > 0.001) {
                        let force = attraction * dt * (0.1 + dist * 0.5);
                        particle.vel += normalize(toMouse) * force;
                    }

                    let speed = length(particle.vel);
                    if (speed > maxSpeed) {
                        particle.vel = normalize(particle.vel) * maxSpeed;
                    }

                    particle.pos += particle.vel * dt;

                    if (abs(particle.pos.x) > 1.0) {
                        particle.vel.x *= -0.8;
                        particle.pos.x = clamp(particle.pos.x, -1.0, 1.0);
                    }
                    if (abs(particle.pos.y) > 1.0) {
                        particle.vel.y *= -0.8;
                        particle.pos.y = clamp(particle.pos.y, -1.0, 1.0);
                    }

                    particles[id.x] = particle;
                }
            `
        });

        const renderShaderModule = this.device.createShaderModule({
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                }

                @vertex
                fn vertexMain(@location(0) particle: vec4f) -> VertexOutput {
                    var output: VertexOutput;
                    output.position = vec4f(particle.xy, 0.0, 1.0);
                    let speed = length(particle.zw);
                    output.color = vec4f(0.2 + speed / 5.0, 0.2, 0.2, 1.0);
                    return output;
                }

                @fragment
                fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
                    return color;
                }
            `
        });

        // Create pipelines
        this.computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.device.createBindGroupLayout({
                        entries: [
                            {
                                binding: 0,
                                visibility: GPUShaderStage.COMPUTE,
                                buffer: { type: 'storage' }
                            },
                            {
                                binding: 1,
                                visibility: GPUShaderStage.COMPUTE,
                                buffer: { type: 'uniform' }
                            }
                        ]
                    })
                ]
            }),
            compute: {
                module: computeShaderModule,
                entryPoint: 'computeMain'
            }
        });

        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: renderShaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    arrayStride: 16,
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x4'
                    }]
                }]
            },
            fragment: {
                module: renderShaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'point-list'
            }
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.particleBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.uniformBuffer }
                }
            ]
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', this.handleResize);
        document.addEventListener('mousemove', this.handleMouseMove);
    }

    removeEventListeners() {
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('mousemove', this.handleMouseMove);
    }

    handleResize() {
        this.updateCanvasSize();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
        this.mouseY = -((e.clientY - rect.top) / rect.height * 2 - 1);
    }

    updateCanvasSize() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    }

    render() {
        if (!this.isRunning) return;

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            new Float32Array([this.mouseX, this.mouseY, deltaTime, 0.0])
        );

        const commandEncoder = this.device.createCommandEncoder();

        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.bindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.PARTICLE_COUNT / this.WORKGROUP_SIZE));
        computePass.end();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                //clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                clearValue: { r: 0.145, g: 0.13333, b: 0.1294, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setVertexBuffer(0, this.particleBuffer);
        renderPass.draw(this.PARTICLE_COUNT);
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
        this.animationFrameId = requestAnimationFrame(this.render);
    }

    cleanup() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.removeEventListeners();
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        // Clear WebGPU resources
        this.particleBuffer?.destroy();
        this.uniformBuffer?.destroy();
        this.particleBuffer = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.computePipeline = null;
        this.renderPipeline = null;
        this.device = null;
        this.context = null;
    }

    async restart() {
        this.cleanup();
        this.canvas = document.createElement('canvas');
        this.setupCanvas();
        document.body.insertBefore(this.canvas, document.body.firstChild);
        await this.initialize();
    }

    addButton() {
        // Add a button to start / stop webgpu, just use text as the button
        const button = document.createElement('button');
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.right = '10px';
        button.style.zIndex = '3';
        button.style.color = 'white';
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        button.style.border = 'none';
        button.style.padding = '10px';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Arial';
        button.style.fontSize = '8px';
        button.style.fontWeight = 'bold';
        button.style.textTransform = 'uppercase';
        button.style.letterSpacing = '1px';
        button.style.outline = 'none';
        button.style.opacity = '0.5';
        button.style.transition = 'opacity 0.2s';
        button.textContent = 'Stop Particles';
        button.addEventListener('mouseover', () => button.style.opacity = '1');
        button.addEventListener('mouseout', () => button.style.opacity = '0.5');
        button.addEventListener('click', () => {
            if (this.isRunning) {
                this.cleanup();
                button.textContent = 'Start Particles';
            } else {
                button.remove();
                this.restart();
            }
        });

        document.getElementById('content').appendChild(button);
    }
}

// Check if mobile
window.mobileCheck = function() {
    let check = false;
    (function(a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};

const particleSystem = new ParticleSystem();
particleSystem.initialize().catch(() => {
    console.error('Failed to initialize WebGPU');
    particleSystem.cleanup();
});
