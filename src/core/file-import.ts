/** File reads may complete out of order; only the latest active read may publish its result. */
export function createFileImporter() {
  let revision = 0;
  return {
    cancel() {
      revision++;
    },
    async read<T>(
      file: Pick<File, 'size' | 'text'>,
      options: {
        maxBytes: number;
        sizeMessage: string;
        parse: (text: string) => T;
        apply: (value: T) => void;
        reportError: (error: unknown) => void;
      },
    ): Promise<void> {
      const request = ++revision;
      try {
        if (file.size > options.maxBytes) throw new Error(options.sizeMessage);
        const text = await file.text();
        if (request !== revision) return;
        options.apply(options.parse(text));
      } catch (error) {
        if (request === revision) options.reportError(error);
      }
    },
  };
}
