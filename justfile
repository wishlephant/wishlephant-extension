start:
		yarn dev

start-firefox:
		yarn dev:firefox

test:
		yarn test-watch

check:
		yarn lint
		yarn test
		yarn build
		yarn build:firefox

format:
		yarn biome check --write .

build:
		yarn build
		yarn build:firefox

zip:
		yarn zip
		yarn zip:firefox

update:
		yarn install
