# PySim
Resgate em Ação: Simulador de Catástrofes
=======
# Resgate em Ação: Simulador de Catástrofes

Um simulador educativo e realista de resposta a múltiplas vítimas em situações de emergência.

## Sobre o Projeto

Este simulador foi desenvolvido para servir como ferramenta educativa para profissionais de saúde, estudantes e gestores de emergência, permitindo o treinamento na coordenação de recursos em cenários de catástrofes.

A simulação segue os protocolos reais de triagem e atendimento, com foco na priorização de vítimas conforme a classificação de gravidade (vermelho, amarelo, verde, cinza).

## Características Principais

- **Mapa Interativo**: Visualização em tempo real de veículos, vítimas, hospitais e áreas de catástrofe
- **Gestão de Recursos**: Despacho de ambulâncias e coordenação com hospitais
- **Sistema de Triagem**: Classificação de vítimas por gravidade (START/SALVAR)
- **Simulação Realista**: Cálculos de tempo de deslocamento, atendimento e transporte
- **Interface Intuitiva**: Painéis de controle e monitoramento de status

## Como Executar

### Instalação Local

#### Requisitos

- Python 3.8 ou superior
- Pip (gerenciador de pacotes Python)

#### Passos para Instalação Local

1. Clone o repositório:
```
git clone https://github.com/seu-usuario/resgate-em-acao.git
cd resgate-em-acao
```

2. Crie um ambiente virtual (opcional, mas recomendado):
```
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# ou
.venv\Scripts\activate  # Windows
```

3. Instale as dependências:
```
pip install -r requirements.txt
```

4. Execute a aplicação:
```
python app.py
```

5. Acesse a aplicação no navegador:
```
http://localhost:5000
```

### Instalação com Docker

#### Requisitos

- Docker instalado na sua máquina
- Docker Compose (opcional, para facilitar o gerenciamento)

#### Instalação Automatizada (Recomendada)

Para facilitar a instalação, criamos um script automatizado que configura e inicia o simulador usando Docker:

1. Clone o repositório:
```
git clone https://github.com/seu-usuario/resgate-em-acao.git
cd resgate-em-acao
```

2. Dê permissão de execução ao script de instalação:
```
chmod +x install_docker.sh
```

3. Execute o script:
```
./install_docker.sh
```

4. Acesse a aplicação no navegador:
```
http://localhost:5000
```

O script verificará se você tem Docker instalado, criará os arquivos necessários, construirá a imagem e iniciará o contêiner automaticamente.

#### Instalação Manual com Docker

Se preferir fazer a instalação manualmente, siga estas etapas:

1. Clone o repositório:
```
git clone https://github.com/seu-usuario/resgate-em-acao.git
cd resgate-em-acao
```

2. Crie um arquivo `Dockerfile` na raiz do projeto com o seguinte conteúdo:
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
```

3. Crie um arquivo `docker-compose.yml` na raiz do projeto (opcional):
```yaml
version: '3'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - .:/app
    restart: unless-stopped
```

4. Construa a imagem Docker:
```
docker build -t resgate-em-acao .
```

5. Execute o contêiner:

   **Usando Docker diretamente:**
   ```
   docker run -p 5000:5000 resgate-em-acao
   ```

   **Usando Docker Compose:**
   ```
   docker-compose up
   ```

6. Acesse a aplicação no navegador:
```
http://localhost:5000
```

#### Parando a Aplicação

- Se estiver usando Docker diretamente, pressione `Ctrl+C` no terminal ou execute:
  ```
  docker ps  # Para ver o ID do contêiner
  docker stop <container_id>
  ```

- Se estiver usando Docker Compose, pressione `Ctrl+C` no terminal ou execute:
  ```
  docker-compose down
  ```

#### Vantagens do Docker

- Ambiente isolado e consistente
- Fácil distribuição e implantação
- Não é necessário instalar dependências diretamente na máquina host
- Funciona da mesma forma em todos os sistemas operacionais compatíveis

## Como Jogar

1. **Configurar Catástrofe**:
   - Escolha o número de vítimas
   - Selecione o tipo de catástrofe
   - Clique em "Iniciar Simulação"

2. **Coordenar Resposta**:
   - Priorize o envio de veículos para vítimas mais graves (vermelhas)
   - Distribua pacientes entre os hospitais disponíveis
   - Monitore o tempo de resposta e a capacidade hospitalar

3. **Objetivos**:
   - Minimizar o tempo de resposta para vítimas críticas
   - Maximizar o número total de vítimas salvas
   - Distribuir eficientemente os recursos disponíveis

## Aspectos Educativos

- Compreensão do sistema START/SALVAR de triagem
- Aprendizado sobre gestão de recursos limitados em emergências
- Entendimento da logística de transporte e distribuição hospitalar
- Treinamento em tomada de decisão sob pressão

## Tecnologias Utilizadas

- **Backend**: Python com Flask
- **Frontend**: JavaScript, HTML5, CSS3
- **Mapa**: Leaflet.js
- **Comunicação em Tempo Real**: Socket.IO
- **Interface**: Bootstrap 5
- **Containerização**: Docker

## Contribuições

Contribuições são bem-vindas! Se você tem ideias para melhorar o simulador, adicionar novos recursos ou corrigir problemas, fique à vontade para abrir um pull request ou uma issue.

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes. 
>>>>>>> 389152f (Primeiro commit)
