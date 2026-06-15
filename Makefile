.PHONY: install test lint format clean coverage quality check-sync ci-local ci-local-fast

install:
	npm install

dev:
npm run dev


build:
	npm run build

test:
	npm test

lint:
	npx eslint .
	npx prettier --check .

format:
	npx eslint --fix .
	npx prettier --write .

quality: lint test

check-sync:
	bash .claude/scripts/validate-metadata-sync.sh

ci-local-fast: lint

ci-local: lint test

clean:
	rm -rf node_modules dist .next .output build coverage

