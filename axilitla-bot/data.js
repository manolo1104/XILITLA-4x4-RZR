// Catálogo completo de vehículos, rutas y precios de Axilitla 4x4

const RUTAS = {
  'Ruta Nanacatli': {
    duracion: 2,
    emoji: '🌿',
    descripcion: 'La ruta más popular de Xilitla. Te adentras en la selva húmeda, cruzas ríos de agua cristalina y llegas a la impresionante cascada Nanacatli. Barro, naturaleza pura y adrenalina garantizada. ¡La favorita de los que visitan por primera vez!'
  },
  'Ruta Miradores': {
    duracion: 3,
    emoji: '🏔️',
    descripcion: 'Sube a los puntos más altos de la sierra y contempla vistas panorámicas que te quitarán el aliento. La Huasteca Potosina desde las alturas, con la selva extendiéndose hasta donde alcanza la vista. Perfecta para fotos épicas e impresionantes.'
  },
  'Ruta Nacimiento': {
    duracion: 4,
    emoji: '💧',
    descripcion: 'La aventura más completa que ofrecemos. Llegas a un nacimiento de agua cristalina escondido profundamente en la selva, rodeado de vegetación que parece sacada de una película. Un paraíso secreto al que es IMPOSIBLE llegar sin nuestros vehículos. Una vez que lo ves, no lo olvidas.'
  },
  'Ruta Trinidad': {
    duracion: 4,
    emoji: '⛪',
    descripcion: 'Historia, cultura y naturaleza en un solo recorrido. Recorre caminos de sierra entre cascadas y ríos hasta llegar al pintoresco pueblo de Trinidad, una comunidad indígena preservada en el tiempo. Paradas en miradores naturales y ríos durante el camino.'
  }
};

const VEHICULOS = [
  {
    id: 'RZR500-01',
    nombre: 'RZR 500',
    capacidadAdultos: 2,
    capacidadNinos: 1,
    emoji: '🏎️',
    descripcion: 'Ágil, deportivo y lleno de carácter. Ideal para parejas o familia pequeña que quieren sentir la adrenalina al máximo.',
    rutas: {
      'Ruta Nanacatli': 1600,
      'Ruta Miradores': 2600,
      'Ruta Nacimiento': 3800,
      'Ruta Trinidad': 3800
    }
  },
  {
    id: 'RZR900-01',
    nombre: 'RZR 900',
    capacidadAdultos: 4,
    capacidadNinos: 0,
    emoji: '💪',
    descripcion: 'El doble de potencia, el doble de emoción. Para grupos de 4 que no le temen a nada.',
    rutas: {
      'Ruta Nanacatli': 1900,
      'Ruta Miradores': 2800,
      'Ruta Nacimiento': 4500,
      'Ruta Trinidad': 4500
    }
  },
  {
    id: 'CANAM-01',
    nombre: 'Can-Am 800',
    capacidadAdultos: 2,
    capacidadNinos: 0,
    emoji: '🔥',
    descripcion: 'La bestia canadiense. Potencia brutal y estilo inigualable para dos aventureros que buscan emociones extremas.',
    rutas: {
      'Ruta Nanacatli': 1600,
      'Ruta Miradores': 2600,
      'Ruta Nacimiento': 3800,
      'Ruta Trinidad': 3800
    }
  },
  {
    id: 'DEF-L-01',
    nombre: 'Defender Familiar',
    capacidadAdultos: 6,
    capacidadNinos: 2,
    emoji: '👨‍👩‍👧‍👦',
    descripcion: 'El más grande de nuestra flota. Diseñado para familias completas o grupos. Cómodo, seguro y con potencia para cualquier terreno.',
    rutas: {
      'Ruta Nanacatli': 2500,
      'Ruta Miradores': 3400,
      'Ruta Nacimiento': 6000,
      'Ruta Trinidad': 6000
    }
  },
  {
    id: 'DEF-01',
    nombre: 'Defender',
    capacidadAdultos: 6,
    capacidadNinos: 0,
    emoji: '🛡️',
    descripcion: 'Robusto, confiable y espacioso. El vehículo ideal para grupos que quieren comodidad sin sacrificar aventura.',
    rutas: {
      'Ruta Nanacatli': 2200,
      'Ruta Miradores': 3000,
      'Ruta Nacimiento': 5000,
      'Ruta Trinidad': 5000
    }
  },
  {
    id: 'DEF-02',
    nombre: 'Defender',
    capacidadAdultos: 6,
    capacidadNinos: 0,
    emoji: '🛡️',
    descripcion: 'Robusto, confiable y espacioso. Perfecto para grupos de hasta 6 personas.',
    rutas: {
      'Ruta Nanacatli': 2200,
      'Ruta Miradores': 3000,
      'Ruta Nacimiento': 5000,
      'Ruta Trinidad': 5000
    }
  },
  {
    id: 'DEF-03',
    nombre: 'Defender',
    capacidadAdultos: 6,
    capacidadNinos: 0,
    emoji: '🛡️',
    descripcion: 'Robusto y confiable para grupos de hasta 6.',
    rutas: {
      'Ruta Nanacatli': 2200,
      'Ruta Miradores': 3000,
      'Ruta Nacimiento': 5000,
      'Ruta Trinidad': 5000
    }
  },
  {
    id: 'DEF-04',
    nombre: 'Defender',
    capacidadAdultos: 6,
    capacidadNinos: 0,
    emoji: '🛡️',
    descripcion: 'Robusto y confiable para grupos de hasta 6.',
    rutas: {
      'Ruta Nanacatli': 2200,
      'Ruta Miradores': 3000,
      'Ruta Nacimiento': 5000,
      'Ruta Trinidad': 5000
    }
  },
  {
    id: 'DEF-05',
    nombre: 'Defender',
    capacidadAdultos: 6,
    capacidadNinos: 0,
    emoji: '🛡️',
    descripcion: 'Robusto y confiable para grupos de hasta 6.',
    rutas: {
      'Ruta Nanacatli': 2200,
      'Ruta Miradores': 3000,
      'Ruta Nacimiento': 5000,
      'Ruta Trinidad': 5000
    }
  },
  {
    id: 'POLARIS-01',
    nombre: 'Polaris Pro S',
    capacidadAdultos: 4,
    capacidadNinos: 0,
    emoji: '⭐',
    descripcion: 'La experiencia premium de nuestra flota. Tecnología de punta, potencia extraordinaria y acabados de lujo. Para quienes quieren lo mejor de lo mejor en off-road.',
    rutas: {
      'Ruta Nanacatli': 3500,
      'Ruta Miradores': 4500,
      'Ruta Nacimiento': 7000,
      'Ruta Trinidad': 7000
    }
  },
  {
    id: 'POLARIS-02',
    nombre: 'Polaris Pro S',
    capacidadAdultos: 4,
    capacidadNinos: 0,
    emoji: '⭐',
    descripcion: 'Experiencia premium off-road para grupos de 4.',
    rutas: {
      'Ruta Nanacatli': 3500,
      'Ruta Miradores': 4500,
      'Ruta Nacimiento': 7000,
      'Ruta Trinidad': 7000
    }
  },
  {
    id: 'MAVERIC-01',
    nombre: 'Maverick X3',
    capacidadAdultos: 4,
    capacidadNinos: 0,
    emoji: '🚀',
    descripcion: 'El más rápido y adrenalínico de la flota. Suspensión de competencia, velocidades que erizan la piel. Para los amantes de la velocidad extrema en la selva.',
    rutas: {
      'Ruta Nanacatli': 2500,
      'Ruta Miradores': 3500,
      'Ruta Nacimiento': 5500,
      'Ruta Trinidad': 5500
    }
  },
  {
    id: 'MAVERIC-02',
    nombre: 'Maverick X3',
    capacidadAdultos: 4,
    capacidadNinos: 0,
    emoji: '🚀',
    descripcion: 'Velocidad extrema en la selva para grupos de 4.',
    rutas: {
      'Ruta Nanacatli': 2500,
      'Ruta Miradores': 3500,
      'Ruta Nacimiento': 5500,
      'Ruta Trinidad': 5500
    }
  }
];

const DATOS_BANCO = {
  banco: 'BBVA',
  titular: 'ESCRIBE AQUI EL TITULAR',
  cuenta: 'ESCRIBE AQUI TU NÚMERO DE CUENTA',
  clabe: 'ESCRIBE AQUI TU CLABE INTERBANCARIA'
};

module.exports = { RUTAS, VEHICULOS, DATOS_BANCO };
