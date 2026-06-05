'use client';
import { useEffect, useRef } from 'react';

const COLORS = ['#2563EB', '#60A5FA', '#FFFFFF', '#3B82F6', '#93C5FD', '#DBEAFE'];

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
}

export default function ConfettiCanvas({ duration = 3000 }: { duration?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: Particle[] = [];
        for (let i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height * 0.5,
                vx: (Math.random() - 0.5) * 6,
                vy: Math.random() * 3 + 2,
                w: Math.random() * 8 + 4,
                h: Math.random() * 6 + 3,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                opacity: 1,
            });
        }

        const startTime = Date.now();
        let animId: number;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const fadeStart = duration * 0.6;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.x += p.vx;
                p.vy += 0.08;
                p.y += p.vy;
                p.vx *= 0.99;
                p.rotation += p.rotationSpeed;

                if (elapsed > fadeStart) {
                    p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            if (elapsed < duration) {
                animId = requestAnimationFrame(animate);
            }
        };

        animId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animId);
    }, [duration]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[10000] pointer-events-none"
            style={{ width: '100vw', height: '100vh' }}
        />
    );
}
