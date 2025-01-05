// Constants for particle system
var PARTICLE_COUNT = 4000000;

// Check if mobile
window.mobileCheck = function() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

if (window.mobileCheck()) {
    PARTICLE_COUNT = 1000000;
}

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
        const deltaTime = (now - lastTime) / 1000;
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
