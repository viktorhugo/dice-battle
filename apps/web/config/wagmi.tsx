import { cookieStorage, createStorage, http } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { celo, celoSepolia } from "@reown/appkit/networks";
import { NETWORK } from "@/lib/constants";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "";

export const networks = (
  NETWORK === "celo_sepolia" ? [celoSepolia, celo] : [celo, celoSepolia]
) as [typeof celoSepolia | typeof celo, typeof celo | typeof celoSepolia];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
  transports: {
    [celo.id]: http(process.env.NEXT_PUBLIC_RPC_URL || "https://forno.celo.org"),
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org"),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
