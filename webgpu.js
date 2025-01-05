// Constants for particle system
const PARTICLE_COUNT = 4000000;
const WORKGROUP_SIZE = 256;

// Create and setup canvas
const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.pointerEvents = 'none';
canvas.style.zIndex = '1';

document.body.insertBefore(canvas, document.body.firstChild);
document.body.style.position = 'relative';
document.body.style.zIndex = '2';
document.body.style.background = 'transparent';

// Mouse position tracking
let mouseX = 0;
let mouseY = 0;

// Initialize WebGPU
async function initWebGPU() {
    if (!navigator.gpu) throw new Error('WebGPU not supported');

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No adapter found');

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
    });

    document.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();

        // Convert to clip space coordinates (-1 to 1)
        mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
        mouseY = -((e.clientY - rect.top) / rect.height * 2 - 1); // Flip Y and convert to clip space
    });

    // Create particle data buffers
    const particleBuffers = new Float32Array(PARTICLE_COUNT * 4); // pos.x, pos.y, vel.x, vel.y
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const baseIndex = i * 4;
        particleBuffers[baseIndex] = Math.random() * 2 - 1; // pos.x
        particleBuffers[baseIndex + 1] = Math.random() * 2 - 1; // pos.y
        particleBuffers[baseIndex + 2] = (Math.random() - 0.5) * 0.1; // vel.x
        particleBuffers[baseIndex + 3] = (Math.random() - 0.5) * 0.1; // vel.y
    }

    // Create storage buffers
    const particleBuffer = device.createBuffer({
        size: particleBuffers.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(particleBuffer.getMappedRange()).set(particleBuffers);
    particleBuffer.unmap();

    // Uniform buffer for mouse position and delta time
    const uniformBuffer = device.createBuffer({
        size: 16, // vec2 mouse + float deltaTime + padding to 16 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create compute shader
    const computeShaderModule = device.createShaderModule({
        code: `
            struct Particle {
                pos: vec2f,
                vel: vec2f,
            }

            struct Uniforms {
                mouse: vec2f,
                deltaTime: f32,
                _pad: f32,  // Explicit padding to maintain 16-byte alignment
            }

            @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
            @group(0) @binding(1) var<uniform> uniforms: Uniforms;

            @compute @workgroup_size(${WORKGROUP_SIZE})
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                if (id.x >= ${PARTICLE_COUNT}u) { return; }

                let attraction = 0.1;
                let maxSpeed = 0.8;
                let dt = uniforms.deltaTime;

                var particle = particles[id.x];

                // Vector from particle to mouse
                let toMouse = uniforms.mouse - particle.pos;
                let dist = length(toMouse);
                
                // Update velocity based on mouse attraction
                if (dist > 0.001) {
                    // Stronger attraction when far, weaker when close
                    let force = attraction * dt * (0.1 + dist * 0.5);
                    particle.vel += normalize(toMouse) * force;
                }

                // Limit velocity
                let speed = length(particle.vel);
                if (speed > maxSpeed) {
                    particle.vel = normalize(particle.vel) * maxSpeed;
                }

                // Update position
                particle.pos += particle.vel * dt;

                // Bounce off edges
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

    // Create render shader
    const renderShaderModule = device.createShaderModule({
        code: `
            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @vertex
            fn vertexMain(@location(0) particle: vec4f) -> VertexOutput {
                var output: VertexOutput;
                output.position = vec4f(particle.xy, 0.0, 1.0);
                
                // Color based on velocity
                let speed = length(particle.zw);
                output.color = vec4f(0.2 + speed / 4.0, 0.2, 0.2, 1.0);
                
                return output;
            }

            @fragment
            fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
                return color;
            }
        `
    });

    // Create compute pipeline
    const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [
                device.createBindGroupLayout({
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

    // Create render pipeline
    const renderPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: renderShaderModule,
            entryPoint: 'vertexMain',
            buffers: [{
                arrayStride: 4 * 4, // vec4f
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
    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: particleBuffer }
            },
            {
                binding: 1,
                resource: { buffer: uniformBuffer }
            }
        ]
    });

    let lastTime = performance.now();

    // Render function
    function render() {
        const now = performance.now();
        const deltaTime = Math.min((now - lastTime) / 1000, 0.1); // Cap at 0.1 seconds
        lastTime = now;

        // Update uniform buffer with mouse position and delta time
        device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([mouseX, mouseY, deltaTime, 0.0]));

        const commandEncoder = device.createCommandEncoder();

        // Compute pass
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / WORKGROUP_SIZE));
        computePass.end();

        // Render pass
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        renderPass.setPipeline(renderPipeline);
        renderPass.setVertexBuffer(0, particleBuffer);
        renderPass.draw(PARTICLE_COUNT);
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }

    // Handle resize
    window.addEventListener('resize', () => {
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
    });

    // Start rendering
    render();
}

// Initialize
initWebGPU().catch(err => {
    console.error('WebGPU initialization failed:', err);
    canvas.remove();
});
