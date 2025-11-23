up:
	@echo "Starting Docker images..."
	make build
	docker compose -f docker-compose.yml up --build --scale worker=1
	@echo "Docker images started!"

down:
	@echo "Stopping Docker images..."
	docker compose -f docker-compose.yml down -v
	@echo "Docker images stopped!"

build:
	@echo "Building application..."
	cd app && npm run build
	@echo "Application built!"

up-dev:
	@echo "Starting Docker images..."
	docker compose -f docker-compose-dev.yml up --build -d
	@echo "Docker images started!"

down-dev:
	@echo "Stopping Docker images..."
	docker compose -f docker-compose-dev.yml down -v
	@echo "Docker images stopped!"