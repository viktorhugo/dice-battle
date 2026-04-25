-include .env
export

.PHONY: help install build test test-fuzz test-gas coverage fmt fmt-check \
	snapshot storage-check size deploy-sepolia deploy-mainnet \
	verify-sepolia verify-mainnet anvil clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install pinned deps (forge-std, OpenZeppelin)
	forge install foundry-rs/forge-std@v1.14.0 
	forge install OpenZeppelin/openzeppelin-contracts@v5.0.2

build: ## Compile contracts
	forge build

test: ## Run the full test suite
	forge test -vv

test-fuzz: ## Run only fuzz tests with higher verbosity
	forge test --match-test testFuzz -vvv

test-gas: ## Run tests and print a gas report
	forge test --gas-report

coverage: ## Generate coverage summary
	forge coverage --ir-minimum --report summary

size: ## Print deployed bytecode sizes
	forge build --sizes

fmt: ## Format Solidity files
	forge fmt

fmt-check: ## Check formatting (used in CI)
	forge fmt --check

snapshot: ## Write gas snapshots to .gas-snapshot
	forge snapshot

anvil: ## Spin up a local Celo-like fork for manual testing
	anvil --fork-url https://forno.celo.org --chain-id 42220

deploy-sepolia: ## Deploy to Celo Sepolia and verify
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url celo_sepolia \
		--account celo-sepolia \
		--broadcast \
		--verify \
		-vvvv

deploy-mainnet: ## Deploy to Celo mainnet and verify
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url celo \
		--account celo-mainnet \
		--broadcast \
		--verify \
		--slow \
		-vvvv

clean: ## Remove build artifacts
	forge clean
	rm -rf cache out broadcast
