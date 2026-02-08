import { Injectable, signal, OnDestroy } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { environment } from '../../../environments/environment';
import { ConvexCustomLogger } from './convex-logger';
import { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import { appRuntimeConfig } from '@core/config/runtime-config';
import { RuntimeConfigService } from './runtime-config.service';

// Import API to avoid circular inference issues
import * as ConvexApi from '@convex/_generated/api';

@Injectable({
  providedIn: 'root'
})
export class ConvexService implements OnDestroy {
  private client: ConvexClient;
  private subscriptions: Map<string, () => void> = new Map();

  constructor(private configService: RuntimeConfigService) {
    const convexUrl = appRuntimeConfig.convexUrl;

    if (!environment.production) {
      console.log('[ConvexService] initializing client', {
        convexUrl,
      });
    }
    this.client = new ConvexClient(convexUrl, {
      logger: new ConvexCustomLogger()
    });
  }

  get api() {
    // Type assertion to avoid circular type inference
    return (ConvexApi as any).api;
  }

  async query<T extends FunctionReference<'query'>>(
    func: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return this.client.query(func, args);
  }

  async mutation<T extends FunctionReference<'mutation'>>(
    func: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return this.client.mutation(func, args);
  }

  async action<T extends FunctionReference<'action'>>(
    func: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return (this.client as any).action(func, args);
  }

  subscribe<T extends FunctionReference<'query'>>(
    func: T,
    args: FunctionArgs<T>,
    callback: (result: FunctionReturnType<T>) => void
  ): () => void {
    const key = `${func.toString()}-${JSON.stringify(args)}`;

    // Unsubscribe from existing subscription with same key
    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!();
    }

    const unsubscribe = this.client.onUpdate(func, args, callback);
    this.subscriptions.set(key, unsubscribe);

    return () => {
      unsubscribe();
      this.subscriptions.delete(key);
    };
  }

  createReactiveQuery<T extends FunctionReference<'query'>>(
    func: T,
    args: FunctionArgs<T>
  ) {
    const data = signal<FunctionReturnType<T> | undefined>(undefined);
    const loading = signal(true);
    const error = signal<Error | null>(null);

    const unsubscribe = this.client.onUpdate(
      func,
      args,
      (result) => {
        data.set(result);
        loading.set(false);
        error.set(null);
      }
    );

    return {
      data: data.asReadonly(),
      loading: loading.asReadonly(),
      error: error.asReadonly(),
      unsubscribe
    };
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
    this.client.close();
  }
}
