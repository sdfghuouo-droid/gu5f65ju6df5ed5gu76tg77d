<?php
/**
 * CloudDesk - JSON file storage with flock-based writes.
 * Safe for concurrent writes from many agents.
 */

final class CDStorage {
    private string $dir;

    public function __construct(string $dir) {
        $this->dir = $dir;
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0755, true);
        }
    }

    private function file(string $key): string {
        return $this->dir . '/' . preg_replace('/[^a-z0-9_\-]/i', '', $key) . '.json';
    }

    /** Locked read + return current data array (works with exclusive lock while writing caller mutates). */
    public function update(string $key, callable $mutate): bool {
        $file = $this->file($key);
        $fp = fopen($file, 'c+');
        if (!$fp) {
            return false;
        }
        flock($fp, LOCK_EX);

        $raw = '';
        if (filesize($file) > 0) {
            $raw = fread($fp, filesize($file));
            if ($raw === false) {
                $raw = '';
            }
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            $data = [];
        }

        $result = $mutate($data);
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $result !== false;
    }

    /** Read a full collection. */
    public function read(string $key): array {
        $file = $this->file($key);
        if (!is_file($file)) {
            return [];
        }
        $fp = fopen($file, 'c');
        if (!$fp) {
            return [];
        }
        flock($fp, LOCK_SH);
        $raw = filesize($file) > 0 ? fread($fp, filesize($file)) : '';
        flock($fp, LOCK_UN);
        fclose($fp);

        $data = $raw ? json_decode((string)$raw, true) : null;
        return is_array($data) ? $data : [];
    }

    /** Write an entire collection. */
    public function write(string $key, array $data): bool {
        return $this->update($key, function (array &$current) use ($data): bool {
            $current = $data;
            return true;
        });
    }
}