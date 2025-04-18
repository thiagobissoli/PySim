// Variáveis globais de simulação
let DADOS_SIMULACAO = {
    veiculos: [],
    hospitais: [],
    bases: [],
    vitimas: [],
    catastrofe: null
};

let SIMULACAO_ATIVA = false;
let TEMPO_SIMULACAO = 0; // em segundos
let VELOCIDADE_SIMULACAO = 60; // 1 segundo real = 60 segundos simulados (1 minuto)

let timerSimulacao;
let socket;

// Variáveis para controle de triagem
let TRIAGEM_REALIZADA = false;
let VITIMAS_PARA_TRIAR = [];
let VITIMA_ATUAL_TRIAGEM = null;
let CLASSIFICACAO_TRIAGEM = null;

// Inicialização da simulação
function inicializarSimulacao() {
    // Conectar ao Socket.IO
    socket = io();
    
    // Event listeners para eventos de socket
    socket.on('nova_catastrofe', (dados) => {
        DADOS_SIMULACAO = dados;
        atualizarInterface();
        iniciarSimulacaoTempo();
    });
    
    socket.on('atualizacao_status', (dados) => {
        // Atualizar dados locais
        atualizarStatusVeiculo(dados.veiculo);
        atualizarStatusVitima(dados.vitima);
        atualizarStatusHospital(dados.hospital);
        
        // Atualizar interface
        atualizarInterface();
    });
    
    // Carregar dados iniciais
    carregarDadosIniciais();
}

function carregarDadosIniciais() {
    fetch('/api/dados_iniciais')
        .then(response => response.json())
        .then(dados => {
            DADOS_SIMULACAO = dados;
            
            // Inicializar mapa
            inicializarMapa();
            
            // Adicionar hospitais e bases ao mapa
            DADOS_SIMULACAO.hospitais.forEach(hospital => {
                adicionarHospital(hospital);
            });
            
            DADOS_SIMULACAO.bases.forEach(base => {
                adicionarBase(base);
            });
            
            // Adicionar veículos ao mapa
            DADOS_SIMULACAO.veiculos.forEach(veiculo => {
                adicionarVeiculo(veiculo);
            });
            
            // Preencher interface
            atualizarInterface();
        })
        .catch(erro => {
            console.error('Erro ao carregar dados iniciais:', erro);
        });
}

// Controle de tempo da simulação
function iniciarSimulacaoTempo() {
    if (SIMULACAO_ATIVA) return;
    
    SIMULACAO_ATIVA = true;
    
    // Mostrar painel de simulação e esconder painel de configuração
    document.getElementById('painel-configuracao').classList.add('d-none');
    document.getElementById('painel-simulacao').classList.remove('d-none');
    
    // Iniciar timer
    timerSimulacao = setInterval(() => {
        // Atualizar tempo de simulação
        TEMPO_SIMULACAO += 1;
        
        // Converter para minutos e segundos simulados
        const tempoSimulado = TEMPO_SIMULACAO * VELOCIDADE_SIMULACAO;
        const minutos = Math.floor(tempoSimulado / 60);
        const segundos = tempoSimulado % 60;
        
        // Atualizar display de tempo
        document.getElementById('tempo-decorrido').textContent = 
            `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        
        // Executar lógica de movimentação de veículos
        processarMovimentacaoVeiculos();
        
    }, 1000);
}

function pausarSimulacao() {
    if (!SIMULACAO_ATIVA) return;
    
    SIMULACAO_ATIVA = false;
    clearInterval(timerSimulacao);
}

function reiniciarSimulacao() {
    pausarSimulacao();
    
    // Resetar dados
    TEMPO_SIMULACAO = 0;
    
    // Remover todos os marcadores do mapa
    for (let id in marcadores.veiculos) {
        mapa.removeLayer(marcadores.veiculos[id]);
    }
    
    for (let id in marcadores.vitimas) {
        mapa.removeLayer(marcadores.vitimas[id]);
    }
    
    if (marcadores.catastrofe) {
        mapa.removeLayer(marcadores.catastrofe);
    }
    
    if (zonas.quente) mapa.removeLayer(zonas.quente);
    if (zonas.morna) mapa.removeLayer(zonas.morna);
    
    // Limpar marcadores
    marcadores.veiculos = {};
    marcadores.vitimas = {};
    marcadores.catastrofe = null;
    
    // Mostrar painel de configuração e esconder painel de simulação
    document.getElementById('painel-configuracao').classList.remove('d-none');
    document.getElementById('painel-simulacao').classList.add('d-none');
    
    // Recarregar dados iniciais
    carregarDadosIniciais();
}

// Lógica de movimentação de veículos
function processarMovimentacaoVeiculos() {
    DADOS_SIMULACAO.veiculos.forEach(veiculo => {
        if (!veiculo.rota) return;
        
        // Se o veículo estiver em movimento
        if (veiculo.status === 'em_transito' || veiculo.status === 'retornando') {
            // Calcular progresso na rota
            veiculo.progresso_rota += veiculo.velocidade / 60; // km por segundo
            
            // Verificar se chegou ao destino
            if (veiculo.progresso_rota >= veiculo.distancia_total) {
                // Guardar status anterior para verificar mudança
                const statusAnterior = veiculo.status;
                
                // Atualizar status do veículo
                if (statusAnterior === 'em_transito') {
                    // Chegou ao local da catástrofe
                    veiculo.status = 'em_atendimento';
                    veiculo.foi_ao_local = true;
                    
                    // Atualizar posição para o local da catástrofe
                    atualizarVeiculo(veiculo, DADOS_SIMULACAO.catastrofe.latitude, DADOS_SIMULACAO.catastrofe.longitude);
                    
                    // Remover a rota após chegar ao destino
                    if (rotasVeiculos[veiculo.id]) {
                        mapa.removeControl(rotasVeiculos[veiculo.id]);
                        delete rotasVeiculos[veiculo.id];
                    }
                    
                    // Verificar se é a primeira ambulância e a triagem ainda não foi realizada
                    const ehPrimeira = DADOS_SIMULACAO.veiculos.filter(v => 
                        v.status === 'em_atendimento' || 
                        v.status === 'transportando' || 
                        v.status === 'retornando'
                    ).length === 1;
                    
                    // Disparar evento de ambulância chegou ao local (apenas uma vez, na mudança de status)
                    document.dispatchEvent(new CustomEvent('ambulanciaChegouLocal', {
                        detail: { 
                            veiculoId: veiculo.id,
                            primeiraAmbulancia: ehPrimeira && !TRIAGEM_REALIZADA
                        }
                    }));
                } else if (statusAnterior === 'retornando') {
                    // Voltou para a base - modificar APENAS esta ambulância
                    console.log(`Ambulância #${veiculo.id} retornou à base. Atualizando seu status para disponível.`);
                    
                    // Usar atualizarStatusVeiculo para modificar apenas este veículo específico
                    const veiculoAtualizado = {...veiculo, 
                        status: 'disponível',
                        rota: null,
                        vitima: null
                    };
                    
                    // Atualizar o veículo nos dados da simulação
                    atualizarStatusVeiculo(veiculoAtualizado);
                    
                    // Obter a base
                    const base = DADOS_SIMULACAO.bases.find(b => b.nome === veiculoAtualizado.base);
                    
                    // Atualizar posição para a base
                    atualizarVeiculo(veiculoAtualizado, base.latitude, base.longitude);
                    
                    // Remover a rota após chegar ao destino
                    if (rotasVeiculos[veiculoAtualizado.id]) {
                        mapa.removeControl(rotasVeiculos[veiculoAtualizado.id]);
                        delete rotasVeiculos[veiculoAtualizado.id];
                    }
                    
                    // Adicionar notificação de ambulância disponível
                    adicionarLogEvento(`Ambulância #${veiculoAtualizado.id} retornou à base e está disponível para novo atendimento.`);
                    
                    // Adicionar log para debug
                    console.log("Estado das ambulâncias após retorno:", 
                        DADOS_SIMULACAO.veiculos.map(v => `#${v.id}: ${v.status}`).join(', '));
                    
                    // Atualizar interface para mostrar veículo no painel de disponibilidade
                    atualizarInterface();
                    
                    // Notificar outros clientes através do socket, se estiver disponível
                    if (socket) {
                        socket.emit('veiculo_disponivel', { veiculo_id: veiculoAtualizado.id });
                    }
                }
            } else {
                // Se o veículo ainda está em rota mas não temos waypoints, é porque está utilizando rota em linha reta
                if (!veiculo.waypoints) {
                    // Calcular posição atual na rota
                    const origem = veiculo.rota.origem;
                    const destino = veiculo.rota.destino;
                    const progresso = veiculo.progresso_rota / veiculo.distancia_total;
                    
                    // Interpolação linear entre origem e destino
                    const lat = origem.lat + (destino.lat - origem.lat) * progresso;
                    const lng = origem.lng + (destino.lng - origem.lng) * progresso;
                    
                    // Atualizar posição no mapa
                    atualizarVeiculo(veiculo, lat, lng);
                }
                // Quando usando waypoints, o movimento é controlado pela função moverVeiculoEmVias
            }
        } else if (veiculo.status === 'em_atendimento') {
            // Processar tempo de atendimento
            veiculo.tempo_restante -= VELOCIDADE_SIMULACAO / 60; // Reduzir em minutos
            
            // Verificar se a ambulância NÃO está configurada para permanecer no local
            // e se o tempo de atendimento acabou e há uma vítima
            if (veiculo.tempo_restante <= 0 && veiculo.vitima && !veiculo.permanecer_no_local) {
                // Terminou atendimento, iniciar transporte para hospital
                veiculo.status = 'transportando';
                
                // Atualizar status da vítima
                const vitima = DADOS_SIMULACAO.vitimas.find(v => v.id === veiculo.vitima.id);
                vitima.status = 'em transporte';
                atualizarVitima(vitima);
                
                // Iniciar rota para o hospital
                const hospital = DADOS_SIMULACAO.hospitais.find(h => h.id === veiculo.hospital_id);
                
                veiculo.rota = {
                    origem: {
                        lat: DADOS_SIMULACAO.catastrofe.latitude,
                        lng: DADOS_SIMULACAO.catastrofe.longitude
                    },
                    destino: {
                        lat: hospital.latitude,
                        lng: hospital.longitude
                    }
                };
                
                // Calcular distância
                veiculo.distancia_total = calcularDistancia(
                    veiculo.rota.origem.lat, veiculo.rota.origem.lng,
                    veiculo.rota.destino.lat, veiculo.rota.destino.lng
                );
                
                veiculo.progresso_rota = 0;
                
                // Criar rota pelas vias para o hospital
                criarRotaVias(veiculo.rota.origem, veiculo.rota.destino, veiculo.id)
                    .then(waypoints => {
                        veiculo.waypoints = waypoints;
                        // Inicia o movimento pelas vias
                        moverVeiculoEmVias(veiculo, waypoints, () => {
                            // Callback quando chegar ao destino (hospital)
                            veiculo.status = 'retornando';
                            
                            // Atualizar status da vítima
                            const vitima = DADOS_SIMULACAO.vitimas.find(v => v.id === veiculo.vitima.id);
                            vitima.status = 'resgatada';
                            atualizarVitima(vitima);
                            
                            // Atualizar ocupação do hospital
                            const hospital = DADOS_SIMULACAO.hospitais.find(h => h.id === veiculo.hospital_id);
                            hospital.ocupacao++;
                            
                            // Iniciar rota de retorno para a base
                            const base = DADOS_SIMULACAO.bases.find(b => b.nome === veiculo.base);
                            
                            // Definir nova rota (hospital -> base)
                            veiculo.rota = {
                                origem: {
                                    lat: hospital.latitude,
                                    lng: hospital.longitude
                                },
                                destino: {
                                    lat: base.latitude,
                                    lng: base.longitude
                                }
                            };
                            
                            // Calcular distância
                            veiculo.distancia_total = calcularDistancia(
                                veiculo.rota.origem.lat, veiculo.rota.origem.lng,
                                veiculo.rota.destino.lat, veiculo.rota.destino.lng
                            );
                            
                            veiculo.progresso_rota = 0;
                            
                            // Criar rota pelas vias para a base
                            criarRotaVias(veiculo.rota.origem, veiculo.rota.destino, veiculo.id)
                                .then(waypoints => {
                                    veiculo.waypoints = waypoints;
                                    // Inicia movimento de retorno à base
                                    moverVeiculoEmVias(veiculo, waypoints, null);
                                });
                        });
                    });
            } else if (veiculo.tempo_restante <= 0 && veiculo.vitima && veiculo.permanecer_no_local) {
                // Se tem vítima, tempo acabou, mas deve permanecer no local:
                
                // Finaliza o atendimento da vítima atual
                const vitima = DADOS_SIMULACAO.vitimas.find(v => v.id === veiculo.vitima.id);
                
                // Adicionar ao log que o atendimento foi concluído, mas a ambulância permanece no local
                adicionarLogEvento(`Ambulância #${veiculo.id} concluiu o atendimento da Vítima #${vitima.id}, mas permanece no local.`);
                
                // Verificar se há mais vítimas para atender
                const proximasVitimas = DADOS_SIMULACAO.vitimas.filter(v => 
                    v.status === 'aguardando' && 
                    v.gravidade !== 'cinza' &&
                    v.classificacao !== undefined
                );
                
                if (proximasVitimas.length > 0) {
                    // Pegar a próxima vítima mais grave
                    const ordemGravidade = { 'vermelha': 0, 'amarela': 1, 'verde': 2 };
                    proximasVitimas.sort((a, b) => ordemGravidade[a.gravidade] - ordemGravidade[b.gravidade]);
                    
                    const novaVitima = proximasVitimas[0];
                    
                    // Atualizar veiculo com a nova vítima
                    veiculo.vitima = novaVitima;
                    veiculo.tempo_restante = novaVitima.tempo_atendimento;
                    
                    // Adicionar log
                    adicionarLogEvento(`Ambulância #${veiculo.id} agora está atendendo a Vítima #${novaVitima.id} (${novaVitima.gravidade.toUpperCase()}).`);
                } else {
                    // Se não há mais vítimas, limpar a vítima atual e manter no local
                    veiculo.vitima = null;
                    veiculo.tempo_restante = 0;
                    
                    // Adicionar notificação que não há mais vítimas para atender
                    adicionarLogEvento(`Ambulância #${veiculo.id} não tem mais vítimas para atender, mas permanece no local.`);
                }
            }
        } else if (veiculo.status === 'transportando') {
            // O movimento já é controlado por moverVeiculoEmVias
            // Não precisamos mais processar aqui, pois o movimento já acontece nos waypoints
        }
    });
}

// Funções auxiliares
function calcularDistancia(lat1, lon1, lat2, lon2) {
    // Fórmula de Haversine para calcular distância entre dois pontos na Terra
    const R = 6371; // Raio da Terra em km
    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distância em km
    
    return d;
}

function atualizarStatusVeiculo(veiculo) {
    // Atualizar veículo nos dados de simulação
    const index = DADOS_SIMULACAO.veiculos.findIndex(v => v.id === veiculo.id);
    if (index !== -1) {
        DADOS_SIMULACAO.veiculos[index] = veiculo;
    }
}

function atualizarStatusVitima(vitima) {
    // Atualizar vítima nos dados de simulação
    const index = DADOS_SIMULACAO.vitimas.findIndex(v => v.id === vitima.id);
    if (index !== -1) {
        DADOS_SIMULACAO.vitimas[index] = vitima;
    }
}

function atualizarStatusHospital(hospital) {
    // Atualizar hospital nos dados de simulação
    const index = DADOS_SIMULACAO.hospitais.findIndex(h => h.id === hospital.id);
    if (index !== -1) {
        DADOS_SIMULACAO.hospitais[index] = hospital;
    }
}

// Função para despachar veículo
function despacharVeiculo(veiculo_id, vitima_id, hospital_id) {
    fetch('/api/despachar_veiculo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            veiculo_id,
            vitima_id,
            hospital_id
        })
    })
    .then(response => response.json())
    .then(dados => {
        if (dados.status === 'success') {
            console.log('Veículo despachado com sucesso');
            
            // Configurar rota de veículo localmente (simulação cliente)
            const veiculo = DADOS_SIMULACAO.veiculos.find(v => v.id === veiculo_id);
            const vitima = DADOS_SIMULACAO.vitimas.find(v => v.id === vitima_id);
            
            if (veiculo && vitima) {
                // Atualizar status do veículo
                veiculo.status = 'em_transito';
                veiculo.vitima = vitima;
                veiculo.hospital_id = hospital_id;
                
                // Atualizar status da vítima
                vitima.status = 'em_atendimento';
                
                // Obter base e catástrofe para calcular rota
                const base = DADOS_SIMULACAO.bases.find(b => b.nome === veiculo.base);
                
                // Configurar rota (base -> catástrofe)
                veiculo.rota = {
                    origem: {
                        lat: base.latitude,
                        lng: base.longitude
                    },
                    destino: {
                        lat: DADOS_SIMULACAO.catastrofe.latitude,
                        lng: DADOS_SIMULACAO.catastrofe.longitude
                    }
                };
                
                // Calcular distância
                veiculo.distancia_total = calcularDistancia(
                    veiculo.rota.origem.lat, veiculo.rota.origem.lng,
                    veiculo.rota.destino.lat, veiculo.rota.destino.lng
                );
                
                veiculo.progresso_rota = 0;
                
                // Criar rota pelas vias para a catástrofe
                criarRotaVias(veiculo.rota.origem, veiculo.rota.destino, veiculo.id)
                    .then(waypoints => {
                        veiculo.waypoints = waypoints;
                        // Inicia o movimento pelas vias
                        moverVeiculoEmVias(veiculo, waypoints, null);
                    });
                
                // Atualizar interface
                atualizarInterface();
            }
        } else {
            console.error('Erro ao despachar veículo:', dados.message);
        }
    })
    .catch(erro => {
        console.error('Erro ao despachar veículo:', erro);
    });
}

// Inicializar catástrofe
function iniciarCatastrofe(latitude, longitude, numVitimas, tipoCatastrofe) {
    console.log('Iniciando catástrofe:', {latitude, longitude, numVitimas, tipoCatastrofe});
    
    // Limpar o marcador de preview da catástrofe, se existir
    if (marcadores.previewCatastrofe) {
        mapa.removeLayer(marcadores.previewCatastrofe);
        marcadores.previewCatastrofe = null;
    }
    
    fetch('/api/iniciar_catastrofe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            latitude,
            longitude,
            num_vitimas: numVitimas,
            tipo: tipoCatastrofe
        })
    })
    .then(response => {
        console.log('Resposta recebida:', response);
        return response.json();
    })
    .then(dados => {
        console.log('Dados recebidos:', dados);
        if (dados.status === 'success') {
            console.log('Catástrofe iniciada com sucesso');
            
            // Atualizar dados da simulação
            DADOS_SIMULACAO = dados.dados;
            
            // Adicionar catástrofe ao mapa
            adicionarCatastrofe(DADOS_SIMULACAO.catastrofe);
            
            // Adicionar vítimas ao mapa
            DADOS_SIMULACAO.vitimas.forEach(vitima => {
                adicionarVitima(vitima, DADOS_SIMULACAO.catastrofe);
            });
            
            // Atualizar interface
            atualizarInterface();
            
            // Iniciar simulação
            iniciarSimulacaoTempo();
        } else {
            console.error('Erro ao iniciar catástrofe:', dados.message);
        }
    })
    .catch(erro => {
        console.error('Erro ao iniciar catástrofe:', erro);
    });
}

// Adicionar função para registrar eventos no log
function adicionarLogEvento(mensagem) {
    const logEventos = document.getElementById('log-eventos');
    if (logEventos) {
        // Calcular o tempo decorrido da simulação
        const tempoSimulado = TEMPO_SIMULACAO * VELOCIDADE_SIMULACAO;
        const minutos = Math.floor(tempoSimulado / 60);
        const segundos = tempoSimulado % 60;
        const horarioSimulacao = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        
        const item = document.createElement('div');
        item.className = 'log-item';
        item.innerHTML = `<span class="log-tempo">${horarioSimulacao}</span> ${mensagem}`;
        
        logEventos.insertBefore(item, logEventos.firstChild); // Inserir no topo
        
        // Limitar quantidade de mensagens no log (manter últimas 50)
        const itens = logEventos.getElementsByClassName('log-item');
        if (itens.length > 50) {
            logEventos.removeChild(itens[itens.length - 1]);
        }
    }
}

// Função para iniciar a triagem START
function iniciarTriagemSTART() {
    // Preparar lista de vítimas para triagem - apenas as que estão aguardando
    VITIMAS_PARA_TRIAR = DADOS_SIMULACAO.vitimas.filter(v => v.status === 'aguardando');
    
    console.log("Vítimas para triagem:", VITIMAS_PARA_TRIAR);
    console.log("Total de vítimas no sistema:", DADOS_SIMULACAO.vitimas);
    
    // Verificar se há vítimas para triar
    if (VITIMAS_PARA_TRIAR.length === 0) {
        TRIAGEM_REALIZADA = true;
        adicionarLogEvento("Não há vítimas para triagem.");
        iniciarSimulacaoTempo(); // Reiniciar a simulação se não houver vítimas
        return;
    }
    
    // Mostrar modal de triagem
    exibirTriagemProximaVitima();
}

// Exibe a próxima vítima para triagem
function exibirTriagemProximaVitima() {
    // Pegar a próxima vítima da lista
    VITIMA_ATUAL_TRIAGEM = VITIMAS_PARA_TRIAR.shift();
    
    if (!VITIMA_ATUAL_TRIAGEM) {
        // Não há mais vítimas para triar
        TRIAGEM_REALIZADA = true;
        
        // Fechar modal e limpar backdrop
        const modalTriagem = document.getElementById('modal-triagem');
        if (modalTriagem) {
            const modalInstance = bootstrap.Modal.getInstance(modalTriagem);
            if (modalInstance) {
                modalInstance.hide();
                
                // Remover backdrop e classes de modal aberto manualmente
                setTimeout(() => {
                    // Remover qualquer backdrop que ainda esteja presente
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    backdrops.forEach(backdrop => {
                        backdrop.remove();
                    });
                    
                    // Remover classe modal-open do body
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                }, 200);
            }
        }
        
        // Adicionar estatísticas ao log
        const totalVitimas = DADOS_SIMULACAO.vitimas.length;
        const classificacoesCorretas = DADOS_SIMULACAO.vitimas.filter(v => 
            v.classificacao === v.classificacaoCorreta
        ).length;
        
        adicionarLogEvento(`Triagem START completa! Todas as vítimas foram classificadas.`);
        adicionarLogEvento(`Acerto na classificação: ${classificacoesCorretas}/${totalVitimas} (${Math.round(classificacoesCorretas/totalVitimas*100)}%)`);
        
        // Encontrar a primeira ambulância que chegou ao local
        const primeiraAmbulancia = DADOS_SIMULACAO.veiculos.find(v => v.status === 'em_atendimento');
        
        if (primeiraAmbulancia) {
            // Mostrar o modal de ação para a ambulância após um pequeno atraso
            setTimeout(() => {
                adicionarLogEvento(`Triagem concluída. O que a Ambulância #${primeiraAmbulancia.id} deve fazer agora?`);
                abrirModalAcaoAmbulancia(primeiraAmbulancia.id);
            }, 1000);
        } else {
            // Se não houver ambulância, simplesmente reiniciar a simulação
            iniciarSimulacaoTempo();
        }
        
        return;
    }
    
    // Atualizar o modal com os dados da vítima atual
    document.getElementById('vitima-numero').textContent = VITIMA_ATUAL_TRIAGEM.id;
    
    // Gerar valores aleatórios para os sinais clínicos
    const sinaisClinicos = gerarSinaisClinicos();
    
    // Exibir os sinais clínicos no modal
    document.getElementById('vitima-deambulacao').textContent = sinaisClinicos.deambulacao.texto;
    document.getElementById('vitima-respiracao').textContent = sinaisClinicos.respiracao.texto;
    document.getElementById('vitima-perfusao').textContent = sinaisClinicos.perfusao.texto;
    document.getElementById('vitima-mental').textContent = sinaisClinicos.mental.texto;
    
    // Calcular classificação correta (mas não exibir)
    const classificacaoCorreta = calcularClassificacaoSTARTAutomatica(sinaisClinicos);
    
    // Resguardar a classificação correta para verificação posterior
    VITIMA_ATUAL_TRIAGEM.classificacaoCorreta = classificacaoCorreta;
    
    // Remover seleção de botões de classificação
    document.querySelectorAll('.btn-classificar').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Exibir o modal
    const modalTriagem = new bootstrap.Modal(document.getElementById('modal-triagem'));
    modalTriagem.show();
}

// Função para calcular a classificação START automaticamente
function calcularClassificacaoSTARTAutomatica(sinais) {
    // Aplicar algoritmo START
    if (sinais.deambulacao.valor === 'sim') {
        return 'verde'; // Se caminha, é verde
    }
    
    if (sinais.respiracao.valor === 'ausente') {
        return 'cinza'; // Se não respira, é cinza
    }
    
    if (sinais.respiracao.valor === 'rapida' || sinais.perfusao.valor === 'ausente' || sinais.mental.valor === 'alterado') {
        return 'vermelha'; // Se qualquer um desses, é vermelho
    }
    
    return 'amarela'; // Se passou por todos os critérios anteriores, é amarelo
}

// Função para gerar aleatoriamente os sinais clínicos da vítima
function gerarSinaisClinicos() {
    // Gerar um número aleatório entre 0 e 3 para definir o "padrão" da vítima
    // 0: verde, 1: amarela, 2: vermelha, 3: cinza
    const padrao = Math.floor(Math.random() * 4);
    
    let sinais = {
        deambulacao: { valor: 'nao', texto: 'Não consegue andar' },
        respiracao: { valor: 'normal', texto: 'Normal' },
        perfusao: { valor: 'presente', texto: 'Pulso radial presente, TEC normal' },
        mental: { valor: 'normal', texto: 'Obedece comandos' }
    };
    
    switch (padrao) {
        case 0: // Verde
            sinais.deambulacao = { valor: 'sim', texto: 'Sim, consegue andar' };
            break;
            
        case 1: // Amarela (apenas não deambula, mas outros sinais normais)
            // Já está configurado como padrão
            break;
            
        case 2: // Vermelha
            // Aleatoriamente selecionar um ou mais sinais críticos
            const sinaisCriticos = Math.floor(Math.random() * 3) + 1; // 1 a 3 sinais críticos
            
            if (sinaisCriticos > 0) {
                sinais.respiracao = { valor: 'rapida', texto: 'Rápida (>30/min)' };
            }
            
            if (sinaisCriticos > 1) {
                sinais.perfusao = { valor: 'ausente', texto: 'Pulso radial ausente ou TEC >2s' };
            }
            
            if (sinaisCriticos > 2) {
                sinais.mental = { valor: 'alterado', texto: 'Não obedece comandos' };
            }
            break;
            
        case 3: // Cinza
            sinais.respiracao = { valor: 'ausente', texto: 'Ausente ou só com manobras' };
            break;
    }
    
    return sinais;
}

// Função para aplicar a triagem à vítima atual
function aplicarTriagemVitimaAutomatica(classificacao) {
    if (!VITIMA_ATUAL_TRIAGEM) return;
    
    // Atualizar a classificação da vítima
    const index = DADOS_SIMULACAO.vitimas.findIndex(v => v.id === VITIMA_ATUAL_TRIAGEM.id);
    if (index !== -1) {
        const vitimaAtualizada = DADOS_SIMULACAO.vitimas[index];
        
        // Obter a classificação correta calculada anteriormente
        const classificacaoCorreta = VITIMA_ATUAL_TRIAGEM.classificacaoCorreta;
        
        // Guardar classificações para comparação posterior
        vitimaAtualizada.classificacao = classificacao;
        vitimaAtualizada.classificacaoCorreta = classificacaoCorreta;
        
        // Atualizar com nova classificação
        vitimaAtualizada.gravidade = classificacao;
        
        // Aplicar tempo de atendimento conforme a gravidade
        switch (classificacao) {
            case 'vermelha':
                vitimaAtualizada.tempo_atendimento = 15;
                break;
            case 'amarela':
                vitimaAtualizada.tempo_atendimento = 10;
                break;
            case 'verde':
                vitimaAtualizada.tempo_atendimento = 5;
                break;
            case 'cinza':
                vitimaAtualizada.tempo_atendimento = 3;
                break;
        }
        
        // Atualizar no mapa
        atualizarVitimaNoMapa(vitimaAtualizada);
        
        // Adicionar ao log (sem revelar a classificação correta)
        adicionarLogEvento(`Vítima #${vitimaAtualizada.id} classificada como ${classificacao.toUpperCase()}.`);
        
        // Atualizar o painel de vítimas para refletir a nova classificação
        if (typeof atualizarInterface === 'function') {
            atualizarInterface();
        }
    }
    
    // Passar para a próxima vítima
    exibirTriagemProximaVitima();
}

// Função para atualizar a vítima no mapa após a reclassificação
function atualizarVitimaNoMapa(vitima) {
    if (marcadores.vitimas[vitima.id]) {
        // Remover o marcador atual
        mapa.removeLayer(marcadores.vitimas[vitima.id]);
        
        // Criar um novo marcador com a nova classificação
        const catastrofe = DADOS_SIMULACAO.catastrofe;
        
        // Usar a mesma posição do marcador anterior
        const posicaoAnterior = marcadores.vitimas[vitima.id].getLatLng();
        
        const marker = L.marker([posicaoAnterior.lat, posicaoAnterior.lng], {
            icon: icones.vitima[vitima.gravidade]
        }).addTo(mapa);
        
        marker.bindPopup(`
            <div class="popup-vitima vitima-${vitima.gravidade}">
                <h6>Vítima #${vitima.id}</h6>
                <div>Gravidade: ${vitima.gravidade.toUpperCase()}</div>
                <div>Status: ${vitima.status}</div>
            </div>
        `);
        
        // Atualizar o marcador
        marcadores.vitimas[vitima.id] = marker;
    }
}

// Adicionar vítima no mapa
function adicionarVitima(vitima, catastrofe) {
    // Garantir que o status da vítima seja 'aguardando'
    vitima.status = vitima.status || 'aguardando';
    
    // Verificar se a vítima já foi classificada
    const foiClassificada = vitima.classificacao !== undefined;
    const iconeVitima = foiClassificada ? 
        icones.vitima[vitima.gravidade] : 
        icones.vitima['nao_classificada'] || icones.vitima['cinza']; // Fallback para cinza se não existir ícone "não classificada"
    
    // Criar um marcador para a vítima com seu respectivo ícone
    const marker = L.marker([catastrofe.latitude, catastrofe.longitude], {
        icon: iconeVitima
    }).addTo(mapa);
    
    // Texto para gravidade
    const textoGravidade = foiClassificada ? 
        `Gravidade: ${vitima.gravidade.toUpperCase()}` : 
        'Gravidade: NÃO CLASSIFICADA';
    
    marker.bindPopup(`
        <div class="popup-vitima ${foiClassificada ? 'vitima-' + vitima.gravidade : 'vitima-nao-classificada'}">
            <h6>Vítima #${vitima.id}</h6>
            <div>${textoGravidade}</div>
            <div>Status: ${vitima.status}</div>
        </div>
    `);
    
    // Adicionar o marcador à coleção de marcadores
    marcadores.vitimas[vitima.id] = marker;
} 