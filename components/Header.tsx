import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/router"; // Import useRouter from next/router
import React, { useState, useRef, useEffect } from "react"; // Explicitly import React for TSX
import Link from "next/link";
import router from "next/router";
import Image from "next/image"; // Import Image for Next.js image optimization

function Header() {
  const router = useRouter(); // Initialize the router
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to open the modal by setting a URL query parameter
  const openModal = (modalType: string) => {
    // Use router.push to update the URL with the new query parameter
    // shallow: true ensures the page component state isn't reset,
    // and it won't trigger data fetching methods like getServerSideProps.
    router.push(
      {
        pathname: router.pathname, // Keep the current path
        query: { modal: modalType }, // Add or update the 'modal' query parameter
      },
      undefined, // as argument (optional, typically same as href for simple cases)
      { shallow: true }
    );
  };
let link;
if (router.pathname === '/flip') {
  link = <Link href="/dice" className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 max-[750px]:hidden shadow-lg">🎲 Dice</Link> ;
} else if (router.pathname === '/flip/try') {
  link = <Link href="/flip" className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 max-[750px]:hidden shadow-lg">🪙 Coin Flip</Link> ;
} else if (router.pathname === '/dice') {
  link = <Link href="/flip" className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 max-[750px]:hidden shadow-lg">🪙 Coin Flip</Link> ;
} else if (router.pathname === '/dice/try') {
  link = <Link href="/dice" className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 max-[750px]:hidden shadow-lg">🎲 Dice</Link> ;
}

  return (
    <header className="text-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          {link}

          {(router.pathname === "/flip" || router.pathname === "/dice") && 
            <button
              onClick={() => openModal('bets')}
              className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 max-[750px]:hidden shadow-lg"
            >
              My Bets
          </button>}
        </div>
        <div className="flex items-center flex-row">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-xl text-white hover:bg-blue-200/20 font-bold py-2 px-4 rounded mr-2 transition duration-200 shadow-lg flex items-center gap-2"
            >
              <Image src="/sonic-logo.png" alt="Sonic" height={24} width={24} />
              Sonic
              <svg
                className={`ml-2 h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50">
                <div className="py-1">
                  <Link 
                    href="https://sei.broflip.com"
                    target="_blank"
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      setIsDropdownOpen(false);
                    }}
                  >
                    Sei
                  </Link>
                  <Link
                    href="https://sonic.broflip.com"
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    target="_blank"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      }}
                  >
                    Sonic
                  </Link>
                </div>
              </div>
            )}
          </div>
          <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            mounted,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;

            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  'style': {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
                className="hover:bg-blue-200/20 p-2 rounded text-xl"
              >
                {(() => {
                  if (!connected) {
                    return (
                      <button onClick={openConnectModal} type="button">
                        Connect Wallet
                      </button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <button onClick={openChainModal} type="button">
                        Wrong network
                      </button>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={openAccountModal}
                        type="button"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            padding: 0, // Ensure no padding around the balance text
                            boxShadow: 'none',
                            // Add other styles to remove any default button appearance
                        }}
                      >
                        {account.displayBalance ? (
                          <span>{account.displayBalance}</span>
                        ) : (
                          <span>Loading Balance...</span> // Or empty if you prefer
                        )}
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
        </div>
      </div>
    </header>
  );
}

export default Header;