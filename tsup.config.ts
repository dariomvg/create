import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',

  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,

  // Todo lo que ya viene instalado en el proyecto del usuario (o no aplica
  // a un CLI de Node) se deja afuera del bundle en vez de empaquetarlo.
  external: [],

  // Evita que tsup intente tocar los archivos "contenido" que se copian
  // tal cual a los proyectos de los usuarios (no son código del CLI).
  ignoreWatch: ['**/modules/**/templates/**'],
});