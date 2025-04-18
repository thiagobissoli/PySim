from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO
import os
import json
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'resgate_em_acao_secret_key'
socketio = SocketIO(app)

# Dados iniciais de simulação
DADOS_SIMULACAO = {
    'veiculos': [
        {'id': 10, 'tipo': 'USA 10', 'status': 'disponível', 'base': 'Base Santa Lúcia', 
         'velocidade': 60, 'capacidade': 1, 'tempo_preparo': 2},
        {'id': 20, 'tipo': 'USA 20', 'status': 'disponível', 'base': 'Base Mata da Praia', 
         'velocidade': 60, 'capacidade': 1, 'tempo_preparo': 2},
        {'id': 22, 'tipo': 'USB 22', 'status': 'disponível', 'base': 'Base Rodoviária', 
         'velocidade': 60, 'capacidade': 1, 'tempo_preparo': 2},
        {'id': 24, 'tipo': 'USB 24', 'status': 'disponível', 'base': 'Base Rodoviária', 
         'velocidade': 60, 'capacidade': 1, 'tempo_preparo': 2},
        {'id': 0, 'tipo': 'VIR', 'status': 'disponível', 'base': 'Central SAMU', 
         'velocidade': 80, 'capacidade': 1, 'tempo_preparo': 2},
    ],
    'hospitais': [
        {'id': 1, 'nome': 'Hospital Estadual de Urgência e Emergência', 'capacidade': 20, 'ocupacao': 12, 
         'latitude': -20.31861, 'longitude': -40.32324}, # Vitória
        {'id': 2, 'nome': 'Hospital Estadual Jayme Santos Neves', 'capacidade': 40, 'ocupacao': 31, 
         'latitude': -20.19971, 'longitude': -40.22681}, # Serra
        {'id': 3, 'nome': 'Hospital Estadual Antonio Bezerra de Faria', 'capacidade': 10, 'ocupacao': 7, 
         'latitude': -20.33264, 'longitude': -40.29888}, # Vila Velha
    ],
    'bases': [
        {'id': 1, 'nome': 'Central SAMU', 'latitude': -20.21890, 'longitude': -40.29074}, # Serra
        {'id': 2, 'nome': 'Base Santa Lúcia', 'latitude': -20.30683, 'longitude': -40.30212}, # Vitória
        {'id': 3, 'nome': 'Base Mata da Praia', 'latitude': -20.27311, 'longitude': -40.29552}, # Vitória
        {'id': 4, 'nome': 'Base Rodoviária', 'latitude': -20.32113, 'longitude': -40.35265}, # Serra
            ],
    'vitimas': []
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/dados_iniciais')
def dados_iniciais():
    return jsonify(DADOS_SIMULACAO)

@app.route('/api/iniciar_catastrofe', methods=['POST'])
def iniciar_catastrofe():
    dados = request.json
    # Aqui seria implementada a lógica para criar uma nova catástrofe
    latitude = dados.get('latitude', -20.2976)
    longitude = dados.get('longitude', -40.2958)
    num_vitimas = dados.get('num_vitimas', 10)
    
    vitimas = []
    # Gerar vítimas aleatórias com base na gravidade
    gravidades = ['vermelha', 'amarela', 'verde', 'cinza']
    distribuicao = [0.3, 0.4, 0.2, 0.1]  # 30% vermelhas, 40% amarelas, 20% verdes, 10% cinzas
    
    for i in range(num_vitimas):
        import random
        indice_gravidade = random.choices([0, 1, 2, 3], weights=distribuicao)[0]
        vitimas.append({
            'id': i+1,
            'gravidade': gravidades[indice_gravidade],
            'tempo_atendimento': [15, 10, 5, 3][indice_gravidade],  # minutos para atendimento
            'status': 'aguardando'
        })
    
    # Atualizar dados da simulação
    DADOS_SIMULACAO['catastrofe'] = {
        'id': 1,
        'data_hora': datetime.now().isoformat(),
        'latitude': latitude,
        'longitude': longitude,
        'raio_zona_quente': 0.2,  # km
        'raio_zona_morna': 0.5,   # km
    }
    DADOS_SIMULACAO['vitimas'] = vitimas
    
    # Notificar todos os clientes conectados sobre a nova catástrofe
    socketio.emit('nova_catastrofe', DADOS_SIMULACAO)
    
    return jsonify({'status': 'success', 'message': 'Catástrofe iniciada', 'dados': DADOS_SIMULACAO})

@app.route('/api/despachar_veiculo', methods=['POST'])
def despachar_veiculo():
    dados = request.json
    veiculo_id = dados.get('veiculo_id')
    vitima_id = dados.get('vitima_id')
    hospital_id = dados.get('hospital_id')
    
    # Aqui seria implementada a lógica para despachar um veículo
    # Encontrar o veículo, a vítima e o hospital nos dados
    veiculo = next((v for v in DADOS_SIMULACAO['veiculos'] if v['id'] == veiculo_id), None)
    vitima = next((v for v in DADOS_SIMULACAO['vitimas'] if v['id'] == vitima_id), None)
    hospital = next((h for h in DADOS_SIMULACAO['hospitais'] if h['id'] == hospital_id), None)
    
    if veiculo and vitima and hospital:
        # Atualizar status
        veiculo['status'] = 'em trânsito'
        vitima['status'] = 'em atendimento'
        
        # Notificar clientes
        socketio.emit('atualizacao_status', {
            'veiculo': veiculo,
            'vitima': vitima,
            'hospital': hospital
        })
        
        return jsonify({'status': 'success', 'message': 'Veículo despachado'})
    else:
        return jsonify({'status': 'error', 'message': 'Dados inválidos'})

@socketio.on('connect')
def handle_connect():
    print('Cliente conectado ao Socket.IO')

@socketio.on('disconnect')
def handle_disconnect():
    print('Cliente desconectado do Socket.IO')

@socketio.on('veiculo_disponivel')
def handle_veiculo_disponivel(data):
    # Obter ID do veículo disponível
    veiculo_id = data.get('veiculo_id')
    
    # Encontrar o veículo nos dados da simulação
    veiculo = next((v for v in DADOS_SIMULACAO['veiculos'] if v['id'] == veiculo_id), None)
    
    if veiculo:
        # Atualizar status se ainda não estiver disponível
        if veiculo['status'] != 'disponível':
            veiculo['status'] = 'disponível'
            veiculo['vitima'] = None
            
        # Notificar todos os clientes (exceto o emissor) sobre a disponibilidade do veículo
        socketio.emit('atualizacao_status', {'veiculo': veiculo}, broadcast=True, include_self=False)
        
        return {'status': 'success', 'message': f'Veículo {veiculo_id} agora disponível'}
    else:
        return {'status': 'error', 'message': 'Veículo não encontrado'}

if __name__ == '__main__':
    # Verificar e criar diretório de templates se não existir
    if not os.path.exists('templates'):
        os.makedirs('templates')
    
    # Verificar e criar diretório de arquivos estáticos se não existir
    if not os.path.exists('static'):
        os.makedirs('static')
        os.makedirs('static/js')
        os.makedirs('static/css')
    
    socketio.run(app, debug=True, host='0.0.0.0', port=8000) 