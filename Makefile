.PHONY: help up down restart ps logs health config pull clean

help:
	@echo "Comandos disponibles:"
	@echo "  make up       Arrancar servicios"
	@echo "  make down     Detener servicios"
	@echo "  make restart  Reiniciar servicios"
	@echo "  make ps       Mostrar estado"
	@echo "  make logs     Mostrar logs"
	@echo "  make health   Comprobar salud"
	@echo "  make config   Validar Docker Compose"
	@echo "  make pull     Descargar imágenes"
	@echo "  make clean    Eliminar contenedores y volúmenes"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

ps:
	docker compose ps

logs:
	docker compose logs -f --tail=100

health:
	@./scripts/healthcheck.sh

config:
	docker compose config

pull:
	docker compose pull

clean:
	docker compose down --volumes --remove-orphans
