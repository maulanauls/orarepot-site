up:
	docker compose up --build -d
	@echo "Gateway: http://localhost:8080"

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

seed:
	bash scripts/seed.sh

psql:
	docker compose exec postgres psql -U orarepot -d postgres
