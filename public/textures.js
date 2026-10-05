// Generación procedural de texturas Pixel Art

export function createPixelTexture(drawFunction, width = 64, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; // Importante para pixel art
    
    drawFunction(ctx, width, height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
}

// Suelo de madera (Parquet)
export const getFloorTexture = () => createPixelTexture((ctx, w, h) => {
    ctx.fillStyle = '#4a3018'; // Base oscura
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#5c3e21';
    for (let i = 0; i < w; i += 8) {
        for (let j = 0; j < h; j += 16) {
            ctx.fillRect(i, j + (i % 16 === 0 ? 0 : 8), 7, 15);
        }
    }
    // Detalles
    ctx.fillStyle = '#3a230e';
    for(let i=0; i<30; i++) {
        ctx.fillRect(Math.random()*w, Math.random()*h, 2, 1);
    }
}, 64, 64);

// Papel tapiz victoriano
export const getWallTexture = () => createPixelTexture((ctx, w, h) => {
    ctx.fillStyle = '#6b1111'; // Rojo oscuro
    ctx.fillRect(0, 0, w, h);
    
    // Franjas doradas
    ctx.fillStyle = '#b38b22';
    for (let i = 0; i < w; i += 16) {
        ctx.fillRect(i, 0, 2, h);
        // Patrón simple de flor/rombo
        for (let j = 8; j < h; j += 32) {
            ctx.fillRect(i - 2, j, 6, 6);
            ctx.fillStyle = '#4a0707';
            ctx.fillRect(i - 1, j + 1, 4, 4);
            ctx.fillStyle = '#b38b22';
        }
    }
    
    // Zócalo de madera abajo
    ctx.fillStyle = '#2b1b0d';
    ctx.fillRect(0, h - 8, w, 8);
    ctx.fillStyle = '#1c1006';
    ctx.fillRect(0, h - 8, w, 2);
}, 64, 64);

// Mesa
export const getTableTexture = () => createPixelTexture((ctx, w, h) => {
    ctx.fillStyle = '#8B5A2B'; 
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6B4226';
    ctx.fillRect(0, 0, w, 4);
    ctx.fillRect(0, h-4, w, 4);
    ctx.fillRect(0, 0, 4, h);
    ctx.fillRect(w-4, 0, 4, h);
    // mantel blanco en el centro
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(8, 8, w-16, h-16);
}, 32, 32);

// Personajes
const masks = [
    { name: 'Oso', color: '#8B4513' },
    { name: 'Lobo', color: '#708090' },
    { name: 'Ciervo', color: '#D2B48C' },
    { name: 'Búho', color: '#8B0000' },
    { name: 'Zorro', color: '#FF8C00' },
    { name: 'Gato', color: '#2F4F4F' },
    { name: 'Cuervo', color: '#191970' },
    { name: 'Cerdo', color: '#FFC0CB' },
    { name: 'Cabra', color: '#F5F5DC' },
    { name: 'Conejo', color: '#FFFFFF' }
];

export const getCharacterTexture = (gender, maskIndex) => createPixelTexture((ctx, w, h) => {
    // Transparencia base
    ctx.clearRect(0, 0, w, h);
    
    const mask = masks[maskIndex % masks.length];
    
    // Sombra en el suelo
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(16, 30, 8, 3, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Cuerpo (Traje formal)
    ctx.fillStyle = '#111'; // Traje negro
    ctx.fillRect(10, 16, 12, 10); // Torso
    
    if (gender === 'female') {
        // Vestido de noche / falda
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(16, 24);
        ctx.lineTo(6, 30);
        ctx.lineTo(26, 30);
        ctx.fill();
    } else {
        // Piernas pantalón
        ctx.fillStyle = '#111';
        ctx.fillRect(10, 25, 5, 5);
        ctx.fillRect(17, 25, 5, 5);
    }
    
    // Camisa blanca
    ctx.fillStyle = '#fff';
    ctx.fillRect(14, 16, 4, 6);
    // Corbata/Moño rojo oscuro
    ctx.fillStyle = '#800000';
    ctx.fillRect(15, 17, 2, 2);
    
    // Cabeza
    ctx.fillStyle = '#ffccaa'; // Piel
    ctx.fillRect(12, 6, 8, 10);
    
    // Máscara
    ctx.fillStyle = mask.color;
    ctx.fillRect(11, 4, 10, 9); // Base máscara
    
    // Orejas/detalles máscara según tipo (muy simplificado)
    if (mask.name === 'Conejo') {
        ctx.fillRect(12, 0, 2, 4);
        ctx.fillRect(18, 0, 2, 4);
    } else if (mask.name === 'Zorro' || mask.name === 'Lobo' || mask.name === 'Gato') {
        ctx.beginPath(); ctx.moveTo(11,4); ctx.lineTo(13,0); ctx.lineTo(15,4); ctx.fill();
        ctx.beginPath(); ctx.moveTo(21,4); ctx.lineTo(19,0); ctx.lineTo(17,4); ctx.fill();
    }
    
    // Detalles de máscara (Ojos oscuros)
    ctx.fillStyle = '#000';
    ctx.fillRect(13, 7, 2, 2);
    ctx.fillRect(17, 7, 2, 2);
    
    // Sombreado simple para dar profundidad 3D (Pixel art shading)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(20, 16, 2, 10); // Sombra lado derecho torso
    ctx.fillRect(19, 4, 2, 9); // Sombra lado derecho máscara

}, 32, 32);
