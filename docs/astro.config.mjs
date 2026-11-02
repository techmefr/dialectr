// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://techmefr.github.io',
	base: '/dialectr',
	integrations: [
		starlight({
			title: 'dialectr',
			description: 'One query, every backend dialect. Zero-dependency query builder that compiles to lomkit, Strapi, PocketBase and more.',
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
