.PHONY: build run clean test unit integration
build:
	npm run build:all
run:
	@echo "Load dist/chrome or dist/edge through Developer mode; load dist/firefox/manifest.json through Firefox about:debugging."
clean:
	node -e "require('fs').rmSync('dist', { recursive: true, force: true })"
test: unit integration
unit:
	npm run test:coverage
integration: build
	npm run test:e2e
