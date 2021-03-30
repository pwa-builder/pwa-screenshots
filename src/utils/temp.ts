import tmp, { dir } from 'tmp';
import del from 'del';

tmp.setGracefulCleanup();

const timeout = 1000 * 60 * 5; // 5 minutes

export async function createTemporaryFile(filename: string, extension: string): Promise<string | undefined> {
  try {
    const prefix = normalizePath(filename);
    return tmp.tmpNameSync({
      prefix,
      postfix: extension,
    });
  } catch (e) {
    console.error(e);
  }
}

export async function createTemporaryDir(dirName: string): Promise<string | undefined> {
  try {
    const prefix = normalizePath(dirName);
    const result = tmp.dirSync({
      prefix
    });

    return result.name;
  } catch (e) {
    console.error(e);
  }
}

export async function scheduleTemporaryFileDeletion(tmpName: string | undefined) {
  try {
    if (tmpName) {
      const fn = async () => await del([normalizePath(tmpName)]);
      setTimeout(fn, timeout);
    }
  } catch (e) {
    console.error(e);
  }
}

export async function scheduleTemporaryDirDeletion(dirPath: string | undefined) {
  try {
    if (dirPath) {
      const fn = async () => await del([normalizePath(dirPath)], { force: true });
      setTimeout(fn, timeout);
    }
  } catch (e) {
    console.error(e);
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}