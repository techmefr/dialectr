// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://techmefr.github.io',
	base: '/dialectr',
	image: { service: passthroughImageService() },
	integrations: [
		starlight({
			title: 'dialectr',
			logo: { light: './src/assets/logo.svg', dark: './src/assets/logo-dark.svg', alt: '' },
			favicon: '/favicon.svg',
			customCss: ['./src/styles/custom.css'],
			expressiveCode: { defaultProps: { frame: 'terminal' } },
			head: [{ tag: 'meta', attrs: { name: 'keywords', content: 'query builder, TypeScript, fluent API, compiler, Lomkit, PocketBase, Strapi, neXdk' } }],
			description: 'One query, any dialect. Zero-dependency TypeScript query builder compiling to Lomkit, PocketBase and Strapi.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/techmefr/dialectr' },
			],
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Query builder', slug: 'guides/query-builder' },
						{ label: 'Adapters', slug: 'guides/adapters' },
						{ label: 'Validation and limits', slug: 'guides/limits' },
					],
				},
				{
					label: 'Extend',
					items: [
						{ label: 'Write your own adapter', slug: 'guides/write-your-own-adapter' },
						{ label: 'Ecosystem', slug: 'guides/ecosystem' },
					],
				},
			],
		}),
	],
});
