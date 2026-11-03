.PHONY: build run clean test unit integration
build:
	npm run build
run:
	@echo "Load the extension/ folder in Chrome using chrome://extensions and Developer mode."
clean:
	node -e "require('fs').rmSync('dist', { recursive: true, force: true })"
test: unit integration
unit:
	npm run test:coverage
integration:
	npm run test:integration
