'use client'

import { wagmiAdapter, projectId } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { celo, celoSepolia } from '@reown/appkit/networks'
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'
import { NETWORK } from '@/lib/constants'
import { networks } from '../../config/wagmi';

// Set up queryClient
const queryClient = new QueryClient()

if (!projectId) {
    throw new Error('Project ID is not defined')
}

// Set up metadata
const metadata = {
    name: "Dice Battle",
    description: "PvP dice battle on Celo. Stake, roll, win — all onchain.",
    url: process.env.NEXT_PUBLIC_URL || "https://dice-battle.vercel.app",
    icons: [`${process.env.NEXT_PUBLIC_URL || "https://dice-battle.vercel.app"}/icon.png`],
}

// Create the modal
createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    defaultNetwork: NETWORK === "celo_sepolia" ? celoSepolia : celo,
    metadata: metadata,
    themeMode: 'dark',
    features: {
        analytics: false, // Optional - defaults to your Cloud configuration
        allWallets: true, 
        email: true,
        // socials: ['google', 'github', 'discord'],
        emailShowWallets: true
    },
    themeVariables: {
        '--w3m-accent': '#000000',
    }
});

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
    const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    )
}

export default ContextProvider