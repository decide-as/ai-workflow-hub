.PHONY: install install-app test lint format clean coverage quality check-sync ci-local ci-local-fast dist

install:
	npm install

dev:
	npm run dev


build:
	npm run build

dist:
	npm run dist

install-app: dist
	@echo "Installing Workflow Hub to /Applications..."
	@rm -rf "/Applications/Workflow Hub.app"
	@cp -r "dist/mac-arm64/Workflow Hub.app" "/Applications/Workflow Hub.app"
	@echo "Installed: $$(defaults read /Applications/Workflow\ Hub.app/Contents/Info CFBundleShortVersionString)"

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

