// Funções de interface do usuário
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar simulação
    inicializarSimulacao();
    
    // Event listeners
    document.getElementById('form-catastrofe').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Obter valores do formulário
        const numVitimas = parseInt(document.getElementById('num-vitimas').value);
        const tipoCatastrofe = document.getElementById('tipo-catastrofe').value;
        
        // Coordenadas aleatórias no mapa atual se não houver preview
        let latitude, longitude;
        
        if (marcadores.previewCatastrofe) {
            const latlng = marcadores.previewCatastrofe.getLatLng();
            latitude = latlng.lat;
            longitude = latlng.lng;
        } else {
            // Usar centro do mapa com um desvio aleatório
            const centro = mapa.getCenter();
            latitude = centro.lat + (Math.random() * 0.02 - 0.01);
            longitude = centro.lng + (Math.random() * 0.02 - 0.01);
        }
        
        // Iniciar catástrofe
        iniciarCatastrofe(latitude, longitude, numVitimas, tipoCatastrofe);
    });
    
    // Configurar listener para evento de atualização de status
    socket.on('atualizacao_status', function(dados) {
        // Se tiver dados de veículo com status atualizado
        if (dados.veiculo) {
            // Atualizar veículo nos dados de simulação
            atualizarStatusVeiculo(dados.veiculo);
            
            // Se o veículo estiver disponível, adicionar ao log
            if (dados.veiculo.status === 'disponível') {
                adicionarLogEvento(`Ambulância #${dados.veiculo.id} retornou à base e está disponível para novo atendimento.`);
            }
            
            // Atualizar a interface
            atualizarInterface();
        }
    });
    
    // Botões de controle de simulação
    document.getElementById('btn-pausar').addEventListener('click', function() {
        if (SIMULACAO_ATIVA) {
            pausarSimulacao();
            this.textContent = 'Continuar';
        } else {
            iniciarSimulacaoTempo();
            this.textContent = 'Pausar';
        }
    });
    
    document.getElementById('btn-reiniciar').addEventListener('click', function() {
        if (confirm('Tem certeza que deseja reiniciar a simulação?')) {
            reiniciarSimulacao();
        }
    });
    
    // Modal de despacho
    const modalDespacho = new bootstrap.Modal(document.getElementById('modal-despacho'));
    
    // Confirmar despacho
    document.getElementById('btn-confirmar-despacho').addEventListener('click', function() {
        const veiculoId = parseInt(document.getElementById('despacho-veiculo-info').getAttribute('data-veiculo-id'));
        
        // Despachar veículo diretamente para o local da catástrofe
        despacharVeiculoDireto(veiculoId);
        
        // Fechar modal e remover backdrop
        limparModal(document.getElementById('modal-despacho'));
    });
    
    // Event listeners para triagem START
    document.querySelectorAll('.btn-classificar').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover classe active de todos os botões
            document.querySelectorAll('.btn-classificar').forEach(b => {
                b.classList.remove('active');
            });
            
            // Adicionar classe active ao botão selecionado
            this.classList.add('active');
            
            // Guardar a classificação selecionada
            CLASSIFICACAO_TRIAGEM = this.getAttribute('data-classificacao');
        });
    });
    
    // Event listener para o botão de confirmar triagem
    document.getElementById('btn-confirmar-triagem').addEventListener('click', function() {
        if (!CLASSIFICACAO_TRIAGEM) {
            alert('Por favor, selecione uma classificação para a vítima.');
            return;
        }
        
        // Verificar se a vítima atual de triagem existe (fluxo de triagem START automatizada)
        if (VITIMA_ATUAL_TRIAGEM) {
            // Aplicar a vítima no contexto da triagem START automatizada 
            // usando função de simulacao.js
            aplicarTriagemVitimaAutomatica(CLASSIFICACAO_TRIAGEM);
        } else {
            // Aplicar a classificação à vítima pela interface
            // usando a função local de interface.js
            const vitimaId = document.getElementById('vitima-numero').textContent;
            aplicarTriagemVitima(CLASSIFICACAO_TRIAGEM);
        }
        
        // Resetar a classificação atual
        CLASSIFICACAO_TRIAGEM = null;
    });
    
    // Event listeners para ação de ambulância no local
    document.getElementById('btn-permanecer-local').addEventListener('click', function() {
        // Obter ID da ambulância atual
        const ambulanciaId = parseInt(document.getElementById('ambulancia-id').textContent);
        const ambulancia = DADOS_SIMULACAO.veiculos.find(v => v.id === ambulanciaId);
        
        if (ambulancia) {
            // Criar uma cópia atualizada do veículo
            const veiculoAtualizado = {
                ...ambulancia,
                status: 'em_atendimento',
                permanecer_no_local: true // Flag para indicar que deve permanecer no local por decisão do usuário
            };
            
            // Atualizar o veículo nos dados da simulação usando a função específica
            atualizarStatusVeiculo(veiculoAtualizado);
            
            // Verificar se há vítimas para atender
            const vitimasParaAtender = DADOS_SIMULACAO.vitimas.filter(v => 
                v.status === 'aguardando' && 
                v.gravidade !== 'cinza'
            );
            
            if (vitimasParaAtender.length > 0) {
                // Pegar a primeira vítima mais grave para atender
                const ordemGravidade = { 'vermelha': 0, 'amarela': 1, 'verde': 2 };
                vitimasParaAtender.sort((a, b) => ordemGravidade[a.gravidade] - ordemGravidade[b.gravidade]);
                
                const vitima = vitimasParaAtender[0];
                
                // Atualizar o veículo com a vítima
                const veiculoComVitima = {
                    ...veiculoAtualizado,
                    vitima: vitima,
                    tempo_restante: vitima.tempo_atendimento
                };
                
                // Atualizar novamente
                atualizarStatusVeiculo(veiculoComVitima);
                
                // Adicionar ao log
                adicionarLogEvento(`Ambulância #${ambulanciaId} está atendendo a Vítima #${vitima.id} (${vitima.gravidade.toUpperCase()}) no local.`);
            } else {
                adicionarLogEvento(`Ambulância #${ambulanciaId} permanecerá no local, mas não há vítimas para atender no momento.`);
            }
        }
        
        // Fechar o modal de ação
        limparModal(document.getElementById('modal-acao-ambulancia'));
        
        // Reiniciar a simulação
        iniciarSimulacaoTempo();
        
        // Atualizar a interface para garantir que a ambulância apareça no painel
        atualizarInterface();
    });
    
    document.getElementById('btn-remover-paciente').addEventListener('click', function() {
        // Obter ID da ambulância atual
        const ambulanciaId = parseInt(document.getElementById('ambulancia-id').textContent);
        
        // Fechar o modal de ação
        limparModal(document.getElementById('modal-acao-ambulancia'));
        
        // Abrir modal de remoção
        abrirModalRemocao(ambulanciaId);
    });
    
    // Função utilitária para garantir que o modal e backdrop sejam completamente removidos
    function limparModal(modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        
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

    // Event listener para confirmar remoção de paciente
    document.getElementById('btn-confirmar-remocao').addEventListener('click', function() {
        const vitimaId = parseInt(document.getElementById('select-remocao-vitima').value);
        const hospitalId = parseInt(document.getElementById('select-remocao-hospital').value);
        const ambulanciaId = parseInt(document.getElementById('modal-remocao-paciente').getAttribute('data-ambulancia-id'));
        
        // Despachar veículo para hospital
        despacharVeiculoParaHospital(ambulanciaId, vitimaId, hospitalId);
        
        // Fechar modal e limpar backdrop
        limparModal(document.getElementById('modal-remocao-paciente'));
        
        // Atualizar a interface para mostrar corretamente todas as ambulâncias disponíveis
        atualizarInterface();
    });
    
    // Event listener para ambulâncias que chegam ao local
    document.addEventListener('ambulanciaChegouLocal', function(evento) {
        const veiculoId = evento.detail.veiculoId;
        const ambulancia = DADOS_SIMULACAO.veiculos.find(v => v.id === veiculoId);
        const primeiraAmbulancia = evento.detail.primeiraAmbulancia || false;
        
        // Verificar se a ambulância existe e está em atendimento
        if (!ambulancia || ambulancia.status !== 'em_atendimento') return;
        
        // Adicionar ao log
        adicionarLogEvento(`Ambulância #${veiculoId} chegou ao local do incidente.`);
        
        // Exibir um alerta informando a chegada da ambulância
        alert(`Ambulância #${veiculoId} chegou ao local do incidente!`);
        
        // Pausar a simulação para a decisão
        pausarSimulacao();
        
        // Verificar se é a primeira ambulância e a triagem ainda não foi realizada
        if (primeiraAmbulancia && !TRIAGEM_REALIZADA) {
            // Se for a primeira ambulância, iniciar triagem
            iniciarTriagemSTART();
        } else {
            // Mostrar modal de ação para esta ambulância
            abrirModalAcaoAmbulancia(veiculoId);
        }
    });
});

// Atualização da interface
function atualizarInterface() {
    atualizarListaVeiculos();
    atualizarListaVitimas();
    atualizarListaHospitais();
    atualizarContagemVitimas();
}

function atualizarListaVeiculos() {
    const listaVeiculos = document.getElementById('lista-veiculos');
    listaVeiculos.innerHTML = '';
    
    // Não filtrar mais veículos, mostrar todos independente do status
    const veiculos = DADOS_SIMULACAO.veiculos;
    
    if (veiculos.length === 0) {
        listaVeiculos.innerHTML = '<div class="card mb-2"><div class="card-body p-2">Nenhum veículo registrado</div></div>';
        return;
    }
    
    veiculos.forEach(veiculo => {
        const card = document.createElement('div');
        card.className = 'card mb-2';
        
        // Determinar o status para exibição
        let statusExibicao = '';
        let botoesHTML = '';
        
        switch(veiculo.status) {
            case 'disponível':
                statusExibicao = 'Disponível na base';
                botoesHTML = `
                    <button class="btn btn-sm btn-primary btn-despachar mt-1" 
                            data-veiculo-id="${veiculo.id}">
                        Despachar
                    </button>
                `;
                break;
            case 'em_atendimento':
                statusExibicao = 'No local do incidente';
                botoesHTML = `
                    <div class="d-flex gap-2 mt-1">
                        <button class="btn btn-sm btn-success btn-remover-paciente" data-veiculo-id="${veiculo.id}">
                            Remover Paciente
                        </button>
                        <button class="btn btn-sm btn-secondary btn-retornar-base" data-veiculo-id="${veiculo.id}">
                            Retornar para Base
                        </button>
                    </div>
                `;
                break;
            case 'em_transito':
                statusExibicao = 'Em trânsito para o local';
                // Sem botões para veículos em trânsito
                break;
            case 'transportando':
                statusExibicao = 'Transportando vítima ao hospital';
                // Sem botões para veículos transportando vítimas
                break;
            case 'retornando':
                statusExibicao = 'Retornando para a base';
                // Sem botões para veículos retornando
                break;
            default:
                statusExibicao = veiculo.status;
                break;
        }
        
        // Verificar se a ambulância já esteve no local (para reenvio)
        const esteveLa = veiculo.hasOwnProperty('foi_ao_local') && veiculo.foi_ao_local && veiculo.status === 'disponível';
        
        if (esteveLa) {
            botoesHTML = `
                <button class="btn btn-sm btn-success btn-despachar mt-1" 
                        data-veiculo-id="${veiculo.id}" data-retorno="true">
                    Reenviar ao Local
                </button>
            `;
        }
        
        card.innerHTML = `
            <div class="card-body p-2">
                <h6 class="card-title">${veiculo.tipo} #${veiculo.id}</h6>
                <div class="card-text">
                    <div>Base: ${veiculo.base}</div>
                    <div>Status: ${statusExibicao}</div>
                    ${botoesHTML}
                </div>
            </div>
        `;
        
        listaVeiculos.appendChild(card);
    });
    
    // Adicionar event listeners aos botões de despacho
    document.querySelectorAll('.btn-despachar').forEach(btn => {
        btn.addEventListener('click', function() {
            const veiculoId = parseInt(this.getAttribute('data-veiculo-id'));
            const ehRetorno = this.hasAttribute('data-retorno');
            
            if (ehRetorno) {
                // Se já esteve no local, despachar automaticamente
                despacharVeiculoDireto(veiculoId);
                adicionarLogEvento(`Ambulância #${veiculoId} foi redirecionada automaticamente para o local do incidente.`);
            } else {
                // Se nunca esteve no local, abrir modal para confirmar
                abrirModalDespacho(veiculoId);
            }
        });
    });
    
    // Adicionar event listeners aos botões de remover paciente
    document.querySelectorAll('.btn-remover-paciente').forEach(btn => {
        btn.addEventListener('click', function() {
            const veiculoId = parseInt(this.getAttribute('data-veiculo-id'));
            abrirModalRemocao(veiculoId);
        });
    });
    
    // Adicionar event listeners aos botões de retornar para base
    document.querySelectorAll('.btn-retornar-base').forEach(btn => {
        btn.addEventListener('click', function() {
            const veiculoId = parseInt(this.getAttribute('data-veiculo-id'));
            retornarVeiculoParaBase(veiculoId);
        });
    });
}

function atualizarListaVitimas() {
    const listaVitimas = document.getElementById('lista-vitimas');
    listaVitimas.innerHTML = '';
    
    // Filtrar vítimas aguardando resgate
    const vitimasAguardando = DADOS_SIMULACAO.vitimas.filter(v => v.status === 'aguardando');
    
    // Debug: mostrar no console
    console.log("Atualizando painel de vítimas:");
    console.log("Total de vítimas:", DADOS_SIMULACAO.vitimas.length);
    console.log("Vítimas aguardando:", vitimasAguardando.length);
    console.log("Detalhes das vítimas:", vitimasAguardando);
    
    if (vitimasAguardando.length === 0 && DADOS_SIMULACAO.vitimas.length === 0) {
        listaVitimas.innerHTML = '<div class="card"><div class="card-body">Não há vítimas registradas</div></div>';
        return;
    }
    
    if (vitimasAguardando.length === 0 && DADOS_SIMULACAO.vitimas.length > 0) {
        listaVitimas.innerHTML = '<div class="card"><div class="card-body">Todas as vítimas foram atendidas!</div></div>';
        return;
    }
    
    // Separar vítimas classificadas e não classificadas
    const vitimasClassificadas = vitimasAguardando.filter(v => v.classificacao !== undefined);
    const vitimasNaoClassificadas = vitimasAguardando.filter(v => v.classificacao === undefined);
    
    // Ordenar vítimas classificadas por gravidade
    const ordem = { 'vermelha': 0, 'amarela': 1, 'verde': 2, 'cinza': 3 };
    vitimasClassificadas.sort((a, b) => {
        return ordem[a.gravidade] - ordem[b.gravidade];
    });
    
    // Ordenar vítimas não classificadas por ID
    vitimasNaoClassificadas.sort((a, b) => a.id - b.id);
    
    // Combinar listas: primeiro não classificadas, depois classificadas
    const vitimasOrdenadas = [...vitimasNaoClassificadas, ...vitimasClassificadas];
    
    vitimasOrdenadas.forEach(vitima => {
        // Verificar se a vítima já foi classificada
        const foiClassificada = vitima.classificacao !== undefined;
        const cardClass = foiClassificada ? `vitima-${vitima.gravidade}` : 'vitima-nao-classificada';
        
        const card = document.createElement('div');
        card.className = `card mb-2 ${cardClass}`;
        
        let conteudoGravidade = '';
        if (foiClassificada) {
            conteudoGravidade = `
                <div>Gravidade: <strong>${vitima.gravidade.toUpperCase()}</strong></div>
                <div>Tempo de atendimento: ${vitima.tempo_atendimento} min</div>
            `;
        } else {
            conteudoGravidade = `
                <div>Gravidade: <strong>NÃO CLASSIFICADA</strong></div>
                <div>Aguardando triagem...</div>
            `;
        }
        
        card.innerHTML = `
            <div class="card-body p-2">
                <h6 class="card-title">Vítima #${vitima.id}</h6>
                <div class="card-text">
                    ${conteudoGravidade}
                </div>
            </div>
        `;
        
        listaVitimas.appendChild(card);
    });
}

function atualizarListaHospitais() {
    const listaHospitais = document.getElementById('lista-hospitais');
    listaHospitais.innerHTML = '';
    
    DADOS_SIMULACAO.hospitais.forEach(hospital => {
        const item = document.createElement('li');
        item.className = 'list-group-item';
        
        const porcentagemOcupacao = (hospital.ocupacao / hospital.capacidade) * 100;
        let classeProgresso = 'bg-success';
        
        if (porcentagemOcupacao > 75) {
            classeProgresso = 'bg-danger';
        } else if (porcentagemOcupacao > 50) {
            classeProgresso = 'bg-warning';
        }
        
        item.innerHTML = `
            <div><strong>${hospital.nome}</strong></div>
            <div>Ocupação: ${hospital.ocupacao}/${hospital.capacidade}</div>
            <div class="progress mt-1">
                <div class="progress-bar ${classeProgresso}" role="progressbar" 
                     style="width: ${porcentagemOcupacao}%" 
                     aria-valuenow="${hospital.ocupacao}" 
                     aria-valuemin="0" 
                     aria-valuemax="${hospital.capacidade}"></div>
            </div>
        `;
        
        listaHospitais.appendChild(item);
    });
}

function atualizarContagemVitimas() {
    // Contagens por gravidade
    const contagens = {
        vermelha: 0,
        amarela: 0,
        verde: 0,
        cinza: 0,
        nao_classificada: 0
    };
    
    // Apenas vítimas aguardando resgate
    const vitimasAguardando = DADOS_SIMULACAO.vitimas.filter(v => v.status === 'aguardando');
    
    vitimasAguardando.forEach(vitima => {
        if (vitima.classificacao !== undefined) {
            // Se a vítima foi classificada, contar na categoria correspondente
            contagens[vitima.gravidade]++;
        } else {
            // Se a vítima não foi classificada, contar separadamente
            contagens.nao_classificada++;
        }
    });
    
    // Atualizar contadores
    document.getElementById('count-vermelha').textContent = contagens.vermelha;
    document.getElementById('count-amarela').textContent = contagens.amarela;
    document.getElementById('count-verde').textContent = contagens.verde;
    document.getElementById('count-cinza').textContent = contagens.cinza;
    
    // Atualizar contador total
    document.getElementById('vitimas-resgatadas').textContent = 
        DADOS_SIMULACAO.vitimas.filter(v => v.status === 'resgatada').length;
    document.getElementById('total-vitimas').textContent = DADOS_SIMULACAO.vitimas.length;
}

function abrirModalDespacho(veiculoId) {
    // Obter veículo
    const veiculo = DADOS_SIMULACAO.veiculos.find(v => v.id === veiculoId);
    
    if (!veiculo) return;
    
    // Atualizar informações no modal
    const infoVeiculo = document.getElementById('despacho-veiculo-info');
    infoVeiculo.textContent = `${veiculo.tipo} #${veiculo.id} (${veiculo.base})`;
    infoVeiculo.setAttribute('data-veiculo-id', veiculo.id);
    
    // Mostrar modal
    const modalDespacho = new bootstrap.Modal(document.getElementById('modal-despacho'));
    modalDespacho.show();
}

function abrirModalAcaoAmbulancia(ambulanciaId) {
    // Atualizar ID da ambulância no modal
    document.getElementById('ambulancia-id').textContent = ambulanciaId;
    
    // Exibir o modal
    const modalAcao = new bootstrap.Modal(document.getElementById('modal-acao-ambulancia'));
    modalAcao.show();
}

function abrirModalRemocao(ambulanciaId) {
    // Atribuir o ID da ambulância ao modal
    document.getElementById('modal-remocao-paciente').setAttribute('data-ambulancia-id', ambulanciaId);
    
    // Adicionar ao log para debug
    console.log("Abrindo modal de remoção para ambulância #" + ambulanciaId);
    console.log("Vítimas disponíveis:", DADOS_SIMULACAO.vitimas);
    
    // Preencher select de vítimas
    const selectVitima = document.getElementById('select-remocao-vitima');
    selectVitima.innerHTML = '';
    
    // Filtrar vítimas no local que já foram classificadas (exceto cinza)
    const vitimasClassificadas = DADOS_SIMULACAO.vitimas.filter(v => 
        v.status === 'aguardando' && 
        v.classificacao && // Garantir que tenha classificação
        v.gravidade !== 'cinza'
    );
    
    console.log("Vítimas classificadas para remoção:", vitimasClassificadas);
    
    // Ordenar por gravidade
    const ordem = { 'vermelha': 0, 'amarela': 1, 'verde': 2 };
    
    vitimasClassificadas.sort((a, b) => {
        return ordem[a.gravidade] - ordem[b.gravidade];
    });
    
    if (vitimasClassificadas.length === 0) {
        selectVitima.innerHTML = '<option value="">Não há vítimas disponíveis para remoção</option>';
        document.getElementById('btn-confirmar-remocao').disabled = true;
        
        // Alertar o usuário
        alert('Não há vítimas disponíveis para remoção neste momento.');
        
        // Exibir modal mesmo assim para permitir que o usuário volte para a opção anterior
        const modalRemocao = new bootstrap.Modal(document.getElementById('modal-remocao-paciente'));
        modalRemocao.show();
        return;
    }
    
    vitimasClassificadas.forEach(vitima => {
        const option = document.createElement('option');
        option.value = vitima.id;
        option.textContent = `Vítima #${vitima.id} - ${vitima.gravidade.toUpperCase()}`;
        selectVitima.appendChild(option);
    });
    
    // Preencher select de hospitais
    const selectHospital = document.getElementById('select-remocao-hospital');
    selectHospital.innerHTML = '';
    
    DADOS_SIMULACAO.hospitais.forEach(hospital => {
        const option = document.createElement('option');
        option.value = hospital.id;
        option.textContent = `${hospital.nome} (${hospital.ocupacao}/${hospital.capacidade})`;
        selectHospital.appendChild(option);
    });
    
    // Ativar botão de confirmação
    document.getElementById('btn-confirmar-remocao').disabled = false;
    
    // Exibir modal
    const modalRemocao = new bootstrap.Modal(document.getElementById('modal-remocao-paciente'));
    modalRemocao.show();
}

// Função para despachar veículo diretamente para o local da catástrofe
function despacharVeiculoDireto(veiculoId) {
    // Obter veículo
    const veiculo = DADOS_SIMULACAO.veiculos.find(v => v.id === veiculoId);
    
    if (!veiculo) return;
    
    // Atualizar status do veículo
    veiculo.status = 'em_transito';
    
    // Obter base e coordenadas da catástrofe
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
    
    // Adicionar ao log
    adicionarLogEvento(`Ambulância #${veiculo.id} foi despachada para o local do incidente.`);
    
    // Atualizar interface
    atualizarInterface();
}

// Função para despachar veículo com vítima para o hospital
function despacharVeiculoParaHospital(veiculoId, vitimaId, hospitalId) {
    // Obter veículo
    const veiculo = DADOS_SIMULACAO.veiculos.find(v => v.id === veiculoId);
    const vitima = DADOS_SIMULACAO.vitimas.find(v => v.id === vitimaId);
    const hospital = DADOS_SIMULACAO.hospitais.find(h => h.id === hospitalId);
    
    if (!veiculo || !vitima || !hospital) return;
    
    // Criar uma cópia atualizada do veículo
    const veiculoAtualizado = {
        ...veiculo, 
        status: 'transportando',
        vitima: vitima,
        hospital_id: hospitalId,
        rota: {}, // Inicializar a propriedade rota
        permanecer_no_local: false // Limpar a flag ao transportar a vítima
    };
    
    // Atualizar o veículo nos dados da simulação
    atualizarStatusVeiculo(veiculoAtualizado);
    
    // Atualizar status da vítima
    vitima.status = 'em transporte';
    
    // Configurar rota (catástrofe -> hospital)
    veiculoAtualizado.rota = {
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
    veiculoAtualizado.distancia_total = calcularDistancia(
        veiculoAtualizado.rota.origem.lat, veiculoAtualizado.rota.origem.lng,
        veiculoAtualizado.rota.destino.lat, veiculoAtualizado.rota.destino.lng
    );
    
    veiculoAtualizado.progresso_rota = 0;
    
    // Criar rota pelas vias para o hospital
    criarRotaVias(veiculoAtualizado.rota.origem, veiculoAtualizado.rota.destino, veiculoAtualizado.id)
        .then(waypoints => {
            // Atualizar o veículo com os waypoints
            const veiculoComWaypoints = {...veiculoAtualizado, waypoints: waypoints};
            atualizarStatusVeiculo(veiculoComWaypoints);
            
            // Inicia o movimento pelas vias
            moverVeiculoEmVias(veiculoComWaypoints, waypoints, () => {
                // Callback quando chegar ao destino (hospital)
                // Criar uma nova cópia do veículo com status atualizado
                const veiculoRetornando = {
                    ...veiculoComWaypoints,
                    status: 'retornando'
                };
                
                // Atualizar o veículo
                atualizarStatusVeiculo(veiculoRetornando);
                
                // Atualizar status da vítima
                vitima.status = 'resgatada';
                atualizarVitima(vitima);
                
                // Atualizar ocupação do hospital
                hospital.ocupacao++;
                
                // Adicionar ao log
                adicionarLogEvento(`Vítima #${vitima.id} foi entregue ao ${hospital.nome}.`);
                
                // Iniciar rota de retorno para a base
                const base = DADOS_SIMULACAO.bases.find(b => b.nome === veiculoRetornando.base);
                
                // Definir nova rota (hospital -> base)
                veiculoRetornando.rota = {
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
                veiculoRetornando.distancia_total = calcularDistancia(
                    veiculoRetornando.rota.origem.lat, veiculoRetornando.rota.origem.lng,
                    veiculoRetornando.rota.destino.lat, veiculoRetornando.rota.destino.lng
                );
                
                veiculoRetornando.progresso_rota = 0;
                
                // Criar rota pelas vias para a base
                criarRotaVias(veiculoRetornando.rota.origem, veiculoRetornando.rota.destino, veiculoRetornando.id)
                    .then(waypoints => {
                        // Atualizar o veículo com os waypoints para retorno
                        const veiculoRetornandoComWaypoints = {...veiculoRetornando, waypoints: waypoints};
                        atualizarStatusVeiculo(veiculoRetornandoComWaypoints);
                        
                        // Inicia movimento de retorno à base
                        moverVeiculoEmVias(veiculoRetornandoComWaypoints, waypoints, null);
                    });
            });
        });
    
    // Adicionar ao log
    adicionarLogEvento(`Ambulância #${veiculoAtualizado.id} está transportando a vítima #${vitima.id} para ${hospital.nome}.`);
    
    // Atualizar interface
    atualizarInterface();
    
    // Retomar simulação
    iniciarSimulacaoTempo();
}

// Usar a função adicionarLogEvento do arquivo simulacao.js se ela não estiver disponível
if (typeof adicionarLogEvento !== 'function') {
    function adicionarLogEvento(mensagem) {
        const logEventos = document.getElementById('log-eventos');
        if (logEventos) {
            const agora = new Date();
            const horario = agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
            
            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `<span class="log-tempo">${horario}</span> ${mensagem}`;
            
            logEventos.insertBefore(item, logEventos.firstChild); // Inserir no topo
            
            // Limitar quantidade de mensagens no log (manter últimas 50)
            const itens = logEventos.getElementsByClassName('log-item');
            if (itens.length > 50) {
                logEventos.removeChild(itens[itens.length - 1]);
            }
        }
    }
}

/**
 * Calcula a classificação START com base nos parâmetros clínicos selecionados
 * @returns {string} Classificação: 'verde', 'amarela', 'vermelha' ou 'preta'
 */
function calcularClassificacaoSTART() {
    // Obter valores selecionados
    const form = document.getElementById('form-triagem');
    const deambulacao = form.querySelector('input[name="deambulacao"]:checked').value;
    const respiracao = form.querySelector('input[name="respiracao"]:checked').value;
    const perfusao = form.querySelector('input[name="perfusao"]:checked').value;
    const mental = form.querySelector('input[name="mental"]:checked').value;
    
    // Algoritmo START
    if (deambulacao === 'sim') {
        return 'verde'; // Vítima anda (verde)
    }
    
    if (respiracao === 'nao') {
        // Tenta abrir vias aéreas
        if (form.querySelector('input[name="respiracao-apos-abertura"]:checked')?.value === 'sim') {
            return 'vermelha'; // Respira após abertura (vermelha)
        } else {
            return 'preta'; // Não respira mesmo após abertura (preta)
        }
    }
    
    if (respiracao === 'sim' && parseInt(form.querySelector('input[name="freq-respiratoria"]').value) > 30) {
        return 'vermelha'; // FR > 30 (vermelha)
    }
    
    if (perfusao === 'ausente' || perfusao === 'lento') {
        return 'vermelha'; // Perfusão comprometida (vermelha)
    }
    
    if (mental === 'inconsciente') {
        return 'vermelha'; // Inconsciente (vermelha)
    }
    
    // Se chegou até aqui, é amarela
    return 'amarela';
}

/**
 * Aplica a classificação para a vítima atual e verifica se há próxima vítima
 * @param {string} classificacao - Classificação da vítima ('verde', 'amarela', 'vermelha' ou 'preta')
 */
function aplicarTriagemVitima(classificacao) {
    const vitimaId = document.getElementById('vitima-numero').textContent;
    
    // Atualizar classificação da vítima
    const vitima = DADOS_SIMULACAO.vitimas.find(v => v.id === parseInt(vitimaId));
    if (vitima) {
        vitima.classificacao = classificacao;
        
        // Atualizar também o campo gravidade (crucial para seleção de vítimas e processamento)
        vitima.gravidade = classificacao;
        
        // Aplicar tempo de atendimento conforme a gravidade
        switch (classificacao) {
            case 'vermelha':
                vitima.tempo_atendimento = 15;
                break;
            case 'amarela':
                vitima.tempo_atendimento = 10;
                break;
            case 'verde':
                vitima.tempo_atendimento = 5;
                break;
            case 'preta':
            case 'cinza':
                vitima.tempo_atendimento = 3;
                break;
        }
        
        // Registrar evento de triagem
        adicionarLogEvento(`Vítima #${vitimaId} classificada como ${classificacao.toUpperCase()}.`);
        
        // Atualizar no mapa se houver função disponível
        if (typeof atualizarVitimaNoMapa === 'function') {
            atualizarVitimaNoMapa(vitima);
        }
        
        // Atualizar interface
        const vitimaElement = document.querySelector(`.vitima[data-id="${vitimaId}"]`);
        if (vitimaElement) {
            vitimaElement.classList.remove('verde', 'amarela', 'vermelha', 'preta');
            vitimaElement.classList.add(classificacao);
            vitimaElement.setAttribute('data-classificacao', classificacao);
        }
        
        // Fechar modal atual
        limparModal(document.getElementById('modal-triagem'));
        
        // Verificar se há mais vítimas para classificar no mesmo local
        const localId = vitima.local_id;
        const proximasVitimas = DADOS_SIMULACAO.vitimas.filter(v => 
            v.local_id === localId && !v.classificacao
        );
        
        if (proximasVitimas.length > 0) {
            // Abrir modal para próxima vítima
            setTimeout(() => {
                abrirModalTriagem(proximasVitimas[0].id);
            }, 500);
        } else {
            // Fim da triagem
            adicionarLogEvento('Triagem START concluída para todas as vítimas do local.');
            
            // Atualizar interface
            atualizarInterface();
        }
    }
}

/**
 * Abre o modal de triagem para a vítima especificada
 * @param {number} vitimaId - ID da vítima para triagem
 */
function abrirModalTriagem(vitimaId) {
    // Atualizar ID da vítima no modal
    document.getElementById('vitima-numero').textContent = vitimaId;
    
    // Resetar formulário
    document.getElementById('form-triagem').reset();
    document.getElementById('classificacao-automatica').classList.add('d-none');
    document.querySelectorAll('.btn-classificar').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Resetar classificação global
    CLASSIFICACAO_TRIAGEM = null;
    
    // Mostrar o modal
    const modalTriagem = new bootstrap.Modal(document.getElementById('modal-triagem'));
    modalTriagem.show();
}

// Função para fazer a ambulância retornar à base
function retornarVeiculoParaBase(veiculoId) {
    // Obter veículo
    const veiculo = DADOS_SIMULACAO.veiculos.find(v => v.id === veiculoId);
    
    if (!veiculo) return;
    
    // Criar uma cópia atualizada do veículo
    const veiculoAtualizado = {
        ...veiculo, 
        status: 'retornando',
        permanecer_no_local: false // Limpar a flag ao retornar para a base
    };
    
    // Atualizar o veículo nos dados da simulação usando a função específica
    atualizarStatusVeiculo(veiculoAtualizado);
    
    // Obter base para determinar destino
    const base = DADOS_SIMULACAO.bases.find(b => b.nome === veiculoAtualizado.base);
    
    // Configurar rota (local da catástrofe -> base)
    veiculoAtualizado.rota = {
        origem: {
            lat: DADOS_SIMULACAO.catastrofe.latitude,
            lng: DADOS_SIMULACAO.catastrofe.longitude
        },
        destino: {
            lat: base.latitude,
            lng: base.longitude
        }
    };
    
    // Calcular distância
    veiculoAtualizado.distancia_total = calcularDistancia(
        veiculoAtualizado.rota.origem.lat, veiculoAtualizado.rota.origem.lng,
        veiculoAtualizado.rota.destino.lat, veiculoAtualizado.rota.destino.lng
    );
    
    veiculoAtualizado.progresso_rota = 0;
    
    // Criar rota pelas vias para a base
    criarRotaVias(veiculoAtualizado.rota.origem, veiculoAtualizado.rota.destino, veiculoAtualizado.id)
        .then(waypoints => {
            // Atualizar o veículo novamente com os waypoints
            const veiculoComWaypoints = {...veiculoAtualizado, waypoints: waypoints};
            atualizarStatusVeiculo(veiculoComWaypoints);
            
            // Inicia o movimento pelas vias
            moverVeiculoEmVias(veiculoComWaypoints, waypoints, null);
        });
    
    // Adicionar ao log
    adicionarLogEvento(`Ambulância #${veiculoAtualizado.id} foi enviada de volta para sua base.`);
    
    // Atualizar interface
    atualizarInterface();
    
    // Reiniciar a simulação se estiver pausada
    if (!SIMULACAO_ATIVA) {
        iniciarSimulacaoTempo();
    }
} 