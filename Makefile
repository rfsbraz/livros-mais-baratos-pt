.PHONY: build run clean test unit integration
build:
	npm run build:all
run:
	@echo "Carrega dist/chrome ou dist/edge no modo de programador; no Firefox, carrega dist/firefox/manifest.json através de about:debugging."
clean:
	node -e "require('fs').rmSync('dist', { recursive: true, force: true })"
test: unit integration
unit:
	npm run test:coverage
integration: build
	npm run test:e2e
