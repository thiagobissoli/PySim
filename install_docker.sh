#!/bin/bash

# Cores para mensagens
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sem cor

echo -e "${GREEN}=== Instalação Automatizada do Simulador Resgate em Ação ===${NC}"
echo -e "${YELLOW}Este script irá configurar e iniciar o simulador utilizando Docker${NC}"
echo

# Verifica se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker não está instalado. Por favor, instale o Docker primeiro.${NC}"
    echo -e "Visite: https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${GREEN}Docker detectado!${NC}"

# Verifica se o Docker Compose está instalado
if command -v docker-compose &> /dev/null; then
    USE_COMPOSE=true
    echo -e "${GREEN}Docker Compose detectado!${NC}"
else
    USE_COMPOSE=false
    echo -e "${YELLOW}Docker Compose não encontrado. Será utilizado apenas o Docker.${NC}"
fi

# Cria o Dockerfile
echo -e "${YELLOW}Criando Dockerfile...${NC}"
cat > Dockerfile << 'EOF'
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
EOF
echo -e "${GREEN}Dockerfile criado com sucesso!${NC}"

# Cria o docker-compose.yml se Docker Compose estiver disponível
if [ "$USE_COMPOSE" = true ]; then
    echo -e "${YELLOW}Criando docker-compose.yml...${NC}"
    cat > docker-compose.yml << 'EOF'
version: '3'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - .:/app
    restart: unless-stopped
EOF
    echo -e "${GREEN}docker-compose.yml criado com sucesso!${NC}"
fi

# Constrói a imagem Docker
echo -e "${YELLOW}Construindo a imagem Docker...${NC}"
docker build -t resgate-em-acao .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Imagem Docker construída com sucesso!${NC}"
else
    echo -e "${RED}Falha ao construir a imagem Docker. Verifique os erros acima.${NC}"
    exit 1
fi

# Inicia o contêiner
echo -e "${YELLOW}Iniciando o simulador...${NC}"

if [ "$USE_COMPOSE" = true ]; then
    echo -e "${YELLOW}Utilizando Docker Compose para iniciar o simulador...${NC}"
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Simulador iniciado com sucesso via Docker Compose!${NC}"
    else
        echo -e "${RED}Falha ao iniciar o simulador via Docker Compose. Tentando com Docker puro...${NC}"
        USE_COMPOSE=false
    fi
fi

if [ "$USE_COMPOSE" = false ]; then
    echo -e "${YELLOW}Utilizando Docker para iniciar o simulador...${NC}"
    docker run -d -p 5000:5000 --name resgate-em-acao-container resgate-em-acao
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Simulador iniciado com sucesso via Docker!${NC}"
    else
        echo -e "${RED}Falha ao iniciar o simulador. Verifique os erros acima.${NC}"
        exit 1
    fi
fi

# Informações finais
echo
echo -e "${GREEN}=== Simulador Resgate em Ação instalado com sucesso! ===${NC}"
echo -e "${YELLOW}Acesse o simulador em seu navegador:${NC} http://localhost:5000"
echo
echo -e "${YELLOW}Para parar o simulador, execute:${NC}"

if [ "$USE_COMPOSE" = true ]; then
    echo -e "docker-compose down"
else
    echo -e "docker stop resgate-em-acao-container"
    echo -e "docker rm resgate-em-acao-container"
fi

echo
echo -e "${YELLOW}Para ver os logs do simulador, execute:${NC}"

if [ "$USE_COMPOSE" = true ]; then
    echo -e "docker-compose logs -f"
else
    echo -e "docker logs -f resgate-em-acao-container"
fi

echo
echo -e "${GREEN}Obrigado por utilizar o Simulador Resgate em Ação!${NC}" 