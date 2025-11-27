/// <reference types="vite/client" />

interface Window {
	electronAPI?: {
		platform: NodeJS.Platform;
		versions: NodeJS.ProcessVersions;
	};
}
