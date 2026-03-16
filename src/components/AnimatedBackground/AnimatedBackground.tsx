import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
    className?: string;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
        if (!gl) {
            console.error('WebGL not supported');
            return;
        }

        // Vertex shader - creates a fullscreen quad
        const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

        // Fragment shader - The Universe Within by Martijn Steinrucken
        const fragmentShaderSource = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec4 iMouse;

      // The Universe Within - by Martijn Steinrucken aka BigWings 2018
      // Email:countfrolic@gmail.com Twitter:@The_ArtOfCode
      // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

      #define S(a, b, t) smoothstep(a, b, t)
      #define NUM_LAYERS 4.

      //#define SIMPLE

      float N21(vec2 p) {
        vec3 a = fract(vec3(p.xyx) * vec3(213.897, 653.453, 253.098));
        a += dot(a, a.yzx + 79.76);
        return fract((a.x + a.y) * a.z);
      }

      vec2 GetPos(vec2 id, vec2 offs, float t) {
        float n = N21(id+offs);
        float n1 = fract(n*10.);
        float n2 = fract(n*100.);
        float a = t+n;
        return offs + vec2(sin(a*n1), cos(a*n2))*.4;
      }

      float GetT(vec2 ro, vec2 rd, vec2 p) {
        return dot(p-ro, rd); 
      }

      float LineDist(vec3 a, vec3 b, vec3 p) {
        return length(cross(b-a, p-a))/length(p-a);
      }

      float df_line( in vec2 a, in vec2 b, in vec2 p)
      {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa,ba) / dot(ba,ba), 0., 1.);	
        return length(pa - ba * h);
      }

      float line(vec2 a, vec2 b, vec2 uv) {
        float r1 = .04;
        float r2 = .01;
        
        float d = df_line(a, b, uv);
        float d2 = length(a-b);
        float fade = S(1.5, .5, d2);
        
        fade += S(.05, .02, abs(d2-.75));
        return S(r1, r2, d)*fade;
      }

      float NetLayer(vec2 st, float n, float t) {
        vec2 id = floor(st)+n;

        st = fract(st)-.5;
       
        vec2 p0 = GetPos(id, vec2(-1.,-1.), t);
        vec2 p1 = GetPos(id, vec2(0.,-1.), t);
        vec2 p2 = GetPos(id, vec2(1.,-1.), t);
        vec2 p3 = GetPos(id, vec2(-1.,0.), t);
        vec2 p4 = GetPos(id, vec2(0.,0.), t);
        vec2 p5 = GetPos(id, vec2(1.,0.), t);
        vec2 p6 = GetPos(id, vec2(-1.,1.), t);
        vec2 p7 = GetPos(id, vec2(0.,1.), t);
        vec2 p8 = GetPos(id, vec2(1.,1.), t);
        
        float m = 0.;
        float sparkle = 0.;
        
        // Unrolled loop for WebGL 1.0 compatibility
        vec2 points[9];
        points[0] = p0; points[1] = p1; points[2] = p2;
        points[3] = p3; points[4] = p4; points[5] = p5;
        points[6] = p6; points[7] = p7; points[8] = p8;
        
        // Process each point
        for(int i=0; i<9; i++) {
          vec2 p;
          if(i==0) p = points[0];
          else if(i==1) p = points[1];
          else if(i==2) p = points[2];
          else if(i==3) p = points[3];
          else if(i==4) p = points[4];
          else if(i==5) p = points[5];
          else if(i==6) p = points[6];
          else if(i==7) p = points[7];
          else p = points[8];
          
          m += line(p4, p, st);

          float d = length(st-p);

          float s = (.005/(d*d));
          s *= S(1., .7, d);
          float pulse = sin((fract(p.x)+fract(p.y)+t)*5.)*.4+.6;
          pulse = pow(pulse, 20.);

          s *= pulse;
          sparkle += s;
        }
        
        m += line(p1, p3, st);
        m += line(p1, p5, st);
        m += line(p7, p5, st);
        m += line(p7, p3, st);
        
        float sPhase = (sin(t+n)+sin(t*.1))*.25+.5;
        sPhase += pow(sin(t*.1)*.5+.5, 50.)*5.;
        m += sparkle*sPhase;
        
        return m;
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord )
      {
        vec2 uv = (fragCoord-iResolution.xy*.5)/iResolution.y;
        vec2 M = iMouse.xy/iResolution.xy-.5;
        
        float t = iTime*.1;
        
        float s = sin(t);
        float c = cos(t);
        mat2 rot = mat2(c, -s, s, c);
        vec2 st = uv*rot;  
        M *= rot*2.;
        
        float m = 0.;
        for(float i=0.; i<1.; i+=1./NUM_LAYERS) {
          float z = fract(t+i);
          float size = mix(15., 1., z);
          float fade = S(0., .6, z)*S(1., .8, z);
          
          m += fade * NetLayer(st*size-M*z, i, iTime);
        }
        
        // Modified: Set fft to 0.0 since we don't have audio input
        // Original line: float fft = texelFetch( iChannel0, ivec2(.7,0), 0 ).x;
        float fft = 0.0;
        float glow = -uv.y*fft*2.;
       
        vec3 baseCol = vec3(s, cos(t*.4), -sin(t*.24))*.4+.6;
        vec3 col = baseCol*m;
        col += baseCol*glow;
        
        #ifdef SIMPLE
        uv *= 10.;
        col = vec3(1)*NetLayer(uv, 0., iTime);
        uv = fract(uv);
        #else
        col *= 1.-dot(uv,uv);
        t = mod(iTime, 230.);
        col *= S(0., 20., t)*S(224., 200., t);
        #endif
        
        fragColor = vec4(col,1);
      }

      void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

        // Compile shader
        function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
            const shader = gl.createShader(type);
            if (!shader) return null;

            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }

            return shader;
        }

        // Create and link program
        const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) {
            console.error('Failed to compile shaders');
            return;
        }

        const program = gl.createProgram();
        if (!program) return;

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            return;
        }

        gl.useProgram(program);

        // Set up geometry (fullscreen quad)
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Get uniform locations
        const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
        const iTimeLocation = gl.getUniformLocation(program, 'iTime');
        const iMouseLocation = gl.getUniformLocation(program, 'iMouse');

        // Resize handler
        const resizeCanvas = () => {
            const displayWidth = canvas.clientWidth;
            const displayHeight = canvas.clientHeight;

            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                gl.viewport(0, 0, displayWidth, displayHeight);
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Animation loop
        const startTime = Date.now();
        const render = () => {
            resizeCanvas();

            const time = (Date.now() - startTime) / 1000.0;

            gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
            gl.uniform1f(iTimeLocation, time);
            gl.uniform4f(iMouseLocation, 0.0, 0.0, 0.0, 0.0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            animationFrameRef.current = requestAnimationFrame(render);
        };

        render();

        // Cleanup
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            window.removeEventListener('resize', resizeCanvas);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            gl.deleteBuffer(positionBuffer);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`animated-background ${className}`}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
            }}
        />
    );
};

export default AnimatedBackground;
