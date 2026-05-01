import { openDatabase, Database } from 'react-native-sqlite-storage';
import { CREATE_TABLES_SQL } from './schema';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  return new Promise((resolve, reject) => {
    const database = openDatabase(
      {
        name: 'air_quality_app.db',
        location: 'default',
      },
      () => {
        database.transaction((tx) => {
          tx.executeSql(CREATE_TABLES_SQL, [], () => {
            db = database;
            resolve(database);
          });
        });
      },
      (error) => {
        reject(error);
      }
    );
  });
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    return new Promise((resolve, reject) => {
      db!.close(
        () => {
          db = null;
          resolve();
        },
        (error) => reject(error)
      );
    });
  }
}

export function executeSql(
  sql: string,
  params: (string | number | null)[] = []
): Promise<any> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}
