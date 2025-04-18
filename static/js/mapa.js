// Configuração do mapa
let mapa;
let marcadores = {
    hospitais: {},
    bases: {},
    veiculos: {},
    vitimas: {},
    catastrofe: null
};

let zonas = {
    quente: null,
    morna: null
};

// Ícones personalizados
const icones = {
    hospital: L.icon({
        iconUrl: '/static/img/hospital.png',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    }),
    base: L.icon({
        iconUrl: '/static/img/location-pin.png',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    }),
    ambulancia: L.icon({
        iconUrl: '/static/img/ambulance.png',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    }),
    vitima: {
        vermelha: L.icon({
            iconUrl: '/static/img/pacient.png',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
            className: 'vitima-icon-vermelha'
        }),
        amarela: L.icon({
            iconUrl: '/static/img/pacient.png',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            popupAnchor: [0, -11],
            className: 'vitima-icon-amarela'
        }),
        verde: L.icon({
            iconUrl: '/static/img/pacient.png',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10],
            className: 'vitima-icon-verde'
        }),
        cinza: L.icon({
            iconUrl: '/static/img/pacient.png',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -9],
            className: 'vitima-icon-cinza'
        })
    },
    catastrofe: L.icon({
        iconUrl: '/static/img/crash.png',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
        className: 'catastrofe-icon'
    })
};

// Adicionar variáveis para roteamento
let rotasVeiculos = {};

// Inicialização do mapa
function inicializarMapa() {
    // Configuração inicial do mapa (centrado em Vitória-ES)
    mapa = L.map('mapa').setView([-20.2976, -40.2958], 13);
    
    // Adicionar tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapa);
    
    // Adicionar escala
    L.control.scale({
        imperial: false,
        metric: true
    }).addTo(mapa);
    
    // Event listener para cliques no mapa (para criar catástrofes)
    mapa.on('click', function(e) {
        const coords = e.latlng;
        
        // Exibir preview da localização da catástrofe
        if (marcadores.previewCatastrofe) {
            marcadores.previewCatastrofe.setLatLng(coords);
        } else {
            marcadores.previewCatastrofe = L.marker(coords, {
                icon: icones.catastrofe,
                opacity: 0.8
            }).addTo(mapa);
            
            // Adicionar popup informativo
            marcadores.previewCatastrofe.bindPopup(
                "<strong>Local da Catástrofe</strong><br>Clique em 'Iniciar Simulação' para confirmar este local."
            ).openPopup();
        }
        
        // Adicionar notificação visível
        adicionarLogEvento("Local da catástrofe definido. Clique em 'Iniciar Simulação' para confirmar.");
    });
}

// Funções para adicionar elementos ao mapa
function adicionarHospital(hospital) {
    if (marcadores.hospitais[hospital.id]) {
        return; // Hospital já existe no mapa
    }
    
    const marker = L.marker([hospital.latitude, hospital.longitude], {
        icon: icones.hospital
    }).addTo(mapa);
    
    marker.bindPopup(`
        <div class="popup-hospital">
            <h6>${hospital.nome}</h6>
            <div>Capacidade: ${hospital.ocupacao}/${hospital.capacidade}</div>
            <div class="progress mt-1 mb-1">
                <div class="progress-bar" role="progressbar" 
                     style="width: ${(hospital.ocupacao / hospital.capacidade) * 100}%" 
                     aria-valuenow="${hospital.ocupacao}" 
                     aria-valuemin="0" 
                     aria-valuemax="${hospital.capacidade}"></div>
            </div>
        </div>
    `);
    
    marcadores.hospitais[hospital.id] = marker;
}

function adicionarBase(base) {
    if (marcadores.bases[base.id]) {
        return; // Base já existe no mapa
    }
    
    const marker = L.marker([base.latitude, base.longitude], {
        icon: icones.base
    }).addTo(mapa);
    
    marker.bindPopup(`
        <div class="popup-base">
            <h6>${base.nome}</h6>
            <div>Base de Ambulâncias</div>
        </div>
    `);
    
    marcadores.bases[base.id] = marker;
}

function adicionarCatastrofe(catastrofe) {
    // Remover catástrofe anterior se existir
    if (marcadores.catastrofe) {
        mapa.removeLayer(marcadores.catastrofe);
    }
    
    // Remover zonas anteriores se existirem
    if (zonas.quente) mapa.removeLayer(zonas.quente);
    if (zonas.morna) mapa.removeLayer(zonas.morna);
    
    // Adicionar marcador de catástrofe
    marcadores.catastrofe = L.marker([catastrofe.latitude, catastrofe.longitude], {
        icon: icones.catastrofe
    }).addTo(mapa);
    
    marcadores.catastrofe.bindPopup(`
        <div>
            <h6>Catástrofe</h6>
            <div>Total de Vítimas: ${DADOS_SIMULACAO.vitimas.length}</div>
        </div>
    `);
    
    // Adicionar zonas de catástrofe
    zonas.quente = L.circle([catastrofe.latitude, catastrofe.longitude], {
        radius: catastrofe.raio_zona_quente * 1000, // km para metros
        className: 'zona-quente'
    }).addTo(mapa);
    
    zonas.morna = L.circle([catastrofe.latitude, catastrofe.longitude], {
        radius: catastrofe.raio_zona_morna * 1000, // km para metros
        className: 'zona-morna'
    }).addTo(mapa);
    
    // Centralizar mapa na catástrofe
    mapa.setView([catastrofe.latitude, catastrofe.longitude], 14);
}

function adicionarVitima(vitima, catastrofe) {
    if (marcadores.vitimas[vitima.id]) {
        return; // Vítima já existe no mapa
    }
    
    // Posicionar vítima aleatoriamente dentro da zona quente
    const angulo = Math.random() * 2 * Math.PI;
    const distancia = Math.random() * catastrofe.raio_zona_quente * 1000; // metros
    
    const lat = catastrofe.latitude + (distancia / 111320) * Math.cos(angulo); // 1 grau lat = 111.32 km
    const lng = catastrofe.longitude + (distancia / (111320 * Math.cos(catastrofe.latitude * (Math.PI / 180)))) * Math.sin(angulo);
    
    const marker = L.marker([lat, lng], {
        icon: icones.vitima[vitima.gravidade]
    }).addTo(mapa);
    
    marker.bindPopup(`
        <div class="popup-vitima vitima-${vitima.gravidade}">
            <h6>Vítima #${vitima.id}</h6>
            <div>Gravidade: ${vitima.gravidade.toUpperCase()}</div>
            <div>Status: ${vitima.status}</div>
        </div>
    `);
    
    marcadores.vitimas[vitima.id] = marker;
}

function adicionarVeiculo(veiculo, base) {
    if (marcadores.veiculos[veiculo.id]) {
        return; // Veículo já existe no mapa
    }
    
    // Posicionar veículo na base correspondente
    const baseObj = DADOS_SIMULACAO.bases.find(b => b.nome === veiculo.base);
    
    if (!baseObj) return;
    
    const marker = L.marker([baseObj.latitude, baseObj.longitude], {
        icon: icones.ambulancia
    }).addTo(mapa);
    
    marker.bindPopup(`
        <div>
            <h6>${veiculo.tipo} #${veiculo.id}</h6>
            <div>Status: ${veiculo.status}</div>
            <div>Base: ${veiculo.base}</div>
        </div>
    `);
    
    marcadores.veiculos[veiculo.id] = marker;
}

function criarRotaVias(origem, destino, veiculoId) {
    // Se já existe uma rota para este veículo, remover
    if (rotasVeiculos[veiculoId]) {
        mapa.removeControl(rotasVeiculos[veiculoId]);
    }
    
    // Criar nova rota
    const rota = L.Routing.control({
        waypoints: [
            L.latLng(origem.lat, origem.lng),
            L.latLng(destino.lat, destino.lng)
        ],
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: false,
        show: false, // Não mostrar o controle de UI
        lineOptions: {
            styles: [
                {color: 'blue', opacity: 0.6, weight: 4}
            ],
            addWaypoints: false
        },
        createMarker: function() { return null; } // Não criar marcadores adicionais
    }).addTo(mapa);
    
    rotasVeiculos[veiculoId] = rota;
    
    return new Promise((resolve) => {
        rota.on('routesfound', function(e) {
            const waypoints = e.routes[0].coordinates;
            resolve(waypoints);
        });
    });
}

// Atualizar a função processarMovimentacaoVeiculos no arquivo simulacao.js
// Esta é apenas uma referência de como deve ser implementado
function moverVeiculoEmVias(veiculo, waypoints, callback) {
    let passoAtual = 0;
    const totalPassos = waypoints.length;
    
    function animarMovimento() {
        if (passoAtual < totalPassos) {
            const ponto = waypoints[passoAtual];
            atualizarVeiculo(veiculo, ponto.lat, ponto.lng);
            passoAtual++;
            
            // Calcular progresso proporcional
            veiculo.progresso_rota = passoAtual / totalPassos * veiculo.distancia_total;
            
            // Aguardar um curto intervalo antes do próximo passo
            setTimeout(animarMovimento, 50);
        } else {
            // Chegou ao destino
            if (callback) callback();
        }
    }
    
    // Iniciar animação
    animarMovimento();
}

function atualizarVeiculo(veiculo, novaLatitude, novaLongitude) {
    if (!marcadores.veiculos[veiculo.id]) return;
    
    // Atualizar posição
    marcadores.veiculos[veiculo.id].setLatLng([novaLatitude, novaLongitude]);
    
    // Atualizar popup
    marcadores.veiculos[veiculo.id].bindPopup(`
        <div>
            <h6>${veiculo.tipo} #${veiculo.id}</h6>
            <div>Status: ${veiculo.status}</div>
            <div>Base: ${veiculo.base}</div>
        </div>
    `);
    
    // Adicionar classe de animação se em movimento
    if (veiculo.status === 'em_transito' || veiculo.status === 'retornando' || veiculo.status === 'transportando') {
        marcadores.veiculos[veiculo.id]._icon.classList.add('em-movimento');
    } else {
        marcadores.veiculos[veiculo.id]._icon.classList.remove('em-movimento');
    }
}

function atualizarVitima(vitima) {
    if (!marcadores.vitimas[vitima.id]) return;
    
    // Atualizar popup
    marcadores.vitimas[vitima.id].bindPopup(`
        <div class="popup-vitima vitima-${vitima.gravidade}">
            <h6>Vítima #${vitima.id}</h6>
            <div>Gravidade: ${vitima.gravidade.toUpperCase()}</div>
            <div>Status: ${vitima.status}</div>
        </div>
    `);
    
    // Remover vítima do mapa se já resgatada
    if (vitima.status === 'resgatada') {
        mapa.removeLayer(marcadores.vitimas[vitima.id]);
        delete marcadores.vitimas[vitima.id];
    }
}

// Atualiza o ícone de uma vítima com base na classificação
function atualizarIconeVitima(vitima) {
    if (!vitima || !vitima.marcador) return;
    
    let icone;
    
    switch (vitima.classificacao) {
        case 'vermelho':
            icone = L.icon({
                iconUrl: '/static/img/pacient.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                className: 'vitima-vermelha'
            });
            break;
        case 'amarelo':
            icone = L.icon({
                iconUrl: '/static/img/pacient.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                className: 'vitima-amarela'
            });
            break;
        case 'verde':
            icone = L.icon({
                iconUrl: '/static/img/pacient.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                className: 'vitima-verde'
            });
            break;
        case 'preto':
            icone = L.icon({
                iconUrl: '/static/img/pacient.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                className: 'vitima-preta'
            });
            break;
        default:
            icone = L.icon({
                iconUrl: '/static/img/pacient.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                className: 'vitima'
            });
    }
    
    vitima.marcador.setIcon(icone);
} 