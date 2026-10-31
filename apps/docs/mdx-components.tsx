import { Step, Steps } from "fumadocs-ui/components/steps";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export const getMDXComponents = (components?: MDXComponents): MDXComponents => ({
	...defaultMdxComponents,
	Step,
	Steps,
	...components,
});

export const useMDXComponents = getMDXComponents;
